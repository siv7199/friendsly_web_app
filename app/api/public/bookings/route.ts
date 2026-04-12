import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";
import { buildAccessTokenRecord } from "@/lib/server/booking-access";
import { bookingRangesOverlap, validateBookingSelection } from "@/lib/server/bookings";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  let paymentIntentId: string | null = null;

  try {
    const body = await request.json();
    const sessionId = String(body.guestCheckoutSessionId ?? "");
    paymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId : null;

    if (!sessionId || !paymentIntentId) {
      return NextResponse.json({ error: "Missing guest booking details." }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("guest_checkout_sessions")
      .select(`
        id,
        creator_id,
        package_id,
        guest_contact_id,
        scheduled_at,
        topic,
        status,
        payment_intent_id,
        guest:guest_contacts!guest_contact_id(full_name, email),
        package:call_packages!package_id(id, name, price, duration),
        creator:profiles!creator_id(full_name)
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Guest checkout session not found." }, { status: 404 });
    }

    if (session.status !== "pending") {
      return NextResponse.json({ error: "This checkout session is no longer active." }, { status: 400 });
    }

    await validateBookingSelection({
      creatorId: String(session.creator_id),
      packageId: String(session.package_id),
      scheduledAt: String(session.scheduled_at),
    });

    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ error: "This payment has already been used for a booking." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const expectedAmountCents = Math.round(Number((session as any).package?.price ?? 0) * 1.025 * 100);

    if (paymentIntent.metadata?.guestCheckoutSessionId !== session.id) {
      throw new Error("This payment does not belong to the guest checkout session.");
    }
    if (paymentIntent.amount !== expectedAmountCents) {
      throw new Error("Payment amount does not match this booking.");
    }
    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not completed yet.");
    }

    const { data: creatorBookings, error: conflictError } = await supabase
      .from("bookings")
      .select("scheduled_at, duration")
      .eq("creator_id", session.creator_id)
      .in("status", ["upcoming", "live"]);

    if (conflictError) {
      throw new Error("Could not verify booking conflicts.");
    }

    const hasCreatorConflict = (creatorBookings ?? []).some((booking: any) =>
      bookingRangesOverlap(
        { scheduled_at: booking.scheduled_at, duration: Number(booking.duration ?? 0) },
        { scheduled_at: session.scheduled_at, duration: Number((session as any).package?.duration ?? 0) }
      )
    );

    if (hasCreatorConflict) {
      throw new Error("That time is no longer available.");
    }

    const bookingPrice = roundCurrency(expectedAmountCents / 100);
    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        creator_id: session.creator_id,
        fan_id: null,
        guest_contact_id: session.guest_contact_id,
        booking_owner_type: "guest",
        guest_name_snapshot: (session as any).guest?.full_name ?? null,
        guest_email_snapshot: (session as any).guest?.email ?? null,
        package_id: session.package_id,
        scheduled_at: new Date(String(session.scheduled_at)).toISOString(),
        duration: Number((session as any).package?.duration ?? 0),
        price: bookingPrice,
        status: "upcoming",
        topic: session.topic || null,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("id")
      .single();

    if (insertError || !booking) {
      throw new Error("Could not create booking.");
    }

    const accessToken = buildAccessTokenRecord(72);
    const { error: tokenError } = await supabase
      .from("booking_access_tokens")
      .insert({
        booking_id: booking.id,
        guest_contact_id: session.guest_contact_id,
        token_hash: accessToken.tokenHash,
        purpose: "manage",
        expires_at: accessToken.expiresAt,
      });

    if (tokenError) {
      throw new Error("Could not create booking access token.");
    }

    await supabase
      .from("guest_checkout_sessions")
      .update({
        status: "completed",
        payment_intent_id: paymentIntentId,
        completed_booking_id: booking.id,
      })
      .eq("id", session.id);

    return NextResponse.json({
      bookingId: booking.id,
      accessToken: accessToken.rawToken,
      accessUrl: `/booking-access/${accessToken.rawToken}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create booking.";

    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === "succeeded") {
          await stripe.refunds.create({ payment_intent: paymentIntentId, amount: paymentIntent.amount });
        }
      } catch {
        // Best effort refund if guest booking creation fails after charge.
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
