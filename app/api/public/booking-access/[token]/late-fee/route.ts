import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";
import { getLateFeeAmountForPrice, isLateFeeRequired } from "@/lib/server/bookings";
import { stripe } from "@/lib/server/stripe";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === "confirm" ? "confirm" : "create";
    const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : null;

    const supabase = createServiceClient();
    const { data: tokenRecord, error } = await supabase
      .from("booking_access_tokens")
      .select(`
        booking_id,
        expires_at,
        revoked_at,
        booking:bookings!booking_id(
          id,
          status,
          booking_owner_type,
          scheduled_at,
          price,
          late_fee_paid_at,
          late_fee_amount,
          guest_name_snapshot,
          guest_email_snapshot
        )
      `)
      .eq("token_hash", hashAccessToken(rawToken))
      .is("revoked_at", null)
      .single();

    if (error || !tokenRecord || !tokenRecord.booking) {
      return NextResponse.json({ error: "Booking access link is invalid." }, { status: 404 });
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Booking access link has expired." }, { status: 410 });
    }

    const booking = (tokenRecord as any).booking;
    if (booking.booking_owner_type !== "guest") {
      return NextResponse.json({ error: "This booking should be paid from a signed-in account." }, { status: 400 });
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      return NextResponse.json({ error: "This booking is no longer active." }, { status: 400 });
    }

    if (!isLateFeeRequired({ scheduledAt: booking.scheduled_at, lateFeePaidAt: booking.late_fee_paid_at })) {
      return NextResponse.json({ error: "A late fee is not required for this booking." }, { status: 400 });
    }

    const lateFeeAmount = getLateFeeAmountForPrice(Number(booking.price));
    const lateFeeAmountCents = Math.round(lateFeeAmount * 100);

    if (mode === "confirm") {
      if (!paymentIntentId) {
        return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json({ error: "Late fee payment has not completed yet." }, { status: 400 });
      }
      if (paymentIntent.amount !== lateFeeAmountCents) {
        return NextResponse.json({ error: "Late fee amount does not match this booking." }, { status: 400 });
      }
      if (paymentIntent.metadata?.bookingId !== booking.id || paymentIntent.metadata?.paymentType !== "guest_booking_late_fee") {
        return NextResponse.json({ error: "This payment does not belong to the booking late fee." }, { status: 400 });
      }

      const { data: updatedBooking, error: updateError } = await supabase
        .from("bookings")
        .update({
          late_fee_amount: lateFeeAmount,
          late_fee_payment_intent_id: paymentIntentId,
          late_fee_paid_at: booking.late_fee_paid_at ?? new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select("id, late_fee_amount, late_fee_paid_at")
        .single();

      if (updateError || !updatedBooking) {
        return NextResponse.json({ error: "Could not record the late fee payment." }, { status: 400 });
      }

      return NextResponse.json({ booking: updatedBooking });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: lateFeeAmountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: booking.guest_email_snapshot ?? undefined,
      description: "Friendsly guest booking late fee",
      metadata: {
        paymentType: "guest_booking_late_fee",
        bookingId: booking.id,
        guestName: booking.guest_name_snapshot ?? "Guest",
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
