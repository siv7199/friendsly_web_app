import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";
import { getLateFeeAmountForPrice, isLateFeeRequired } from "@/lib/server/bookings";
import {
  checkRateLimit,
  isPaymentIntentId,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "booking-late-fee", {
      key: user.id,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const bookingId = params.id;
    if (!isUuid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
    }

    const body = await readJsonBody(request);
    const mode = body?.mode === "confirm" ? "confirm" : "create";
    const paymentIntentId = stringField(body, "paymentIntentId", 120) || null;

    const { data: booking, error } = await serviceSupabase
      .from("bookings")
      .select("id, fan_id, status, scheduled_at, price, creator_present, creator_joined_at, late_fee_paid_at, late_fee_amount")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.fan_id !== user.id) {
      return NextResponse.json({ error: "Only the booked fan can pay this late fee." }, { status: 403 });
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      return NextResponse.json({ error: "This booking is no longer active." }, { status: 400 });
    }

    if (!isLateFeeRequired({
      scheduledAt: booking.scheduled_at,
      lateFeePaidAt: booking.late_fee_paid_at,
      creatorPresent: booking.creator_present,
      creatorJoinedAt: booking.creator_joined_at,
    })) {
      return NextResponse.json({ error: "A late fee is not required for this booking." }, { status: 400 });
    }

    const lateFeeAmount = getLateFeeAmountForPrice(Number(booking.price));
    const lateFeeAmountCents = Math.round(lateFeeAmount * 100);

    if (mode === "confirm") {
      if (!paymentIntentId || !isPaymentIntentId(paymentIntentId)) {
        return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json({ error: "Late fee payment has not completed yet." }, { status: 400 });
      }
      if (paymentIntent.amount !== lateFeeAmountCents) {
        return NextResponse.json({ error: "Late fee amount does not match this booking." }, { status: 400 });
      }
      if (paymentIntent.metadata?.bookingId !== bookingId || paymentIntent.metadata?.paymentType !== "booking_late_fee") {
        return NextResponse.json({ error: "This payment does not belong to the booking late fee." }, { status: 400 });
      }

      const { data: updatedBooking, error: updateError } = await serviceSupabase
        .from("bookings")
        .update({
          late_fee_amount: lateFeeAmount,
          late_fee_payment_intent_id: paymentIntentId,
          late_fee_paid_at: booking.late_fee_paid_at ?? new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select("id, late_fee_amount, late_fee_paid_at")
        .single();

      if (updateError || !updatedBooking) {
        return NextResponse.json({ error: "Could not record the late fee payment." }, { status: 400 });
      }

      return NextResponse.json({ booking: updatedBooking });
    }

    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: lateFeeAmountCents,
      currency: "usd",
      customer: customerId,
      receipt_email: user.email ?? undefined,
      automatic_payment_methods: { enabled: true },
      description: "Friendsly booking late fee",
      metadata: {
        paymentType: "booking_late_fee",
        bookingId,
        userId: user.id,
        userEmail: user.email ?? "",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: lateFeeAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process the late fee.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
