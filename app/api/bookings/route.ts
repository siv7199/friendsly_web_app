import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateBookingSelection, findBookingConflicts } from "@/lib/server/bookings";
import { refundPaymentIntent, stripe } from "@/lib/server/stripe";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const serviceSupabase = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let paymentIntentId: string | null = null;

  try {
    const body = await request.json();
    const creatorId = String(body.creatorId ?? "");
    const packageId = String(body.packageId ?? "");
    const scheduledAt = String(body.scheduledAt ?? "");
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    paymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId : null;

    if (!creatorId || !packageId || !scheduledAt || !paymentIntentId) {
      return NextResponse.json({ error: "Missing booking details." }, { status: 400 });
    }

    const bookingSelection = await validateBookingSelection({
      creatorId,
      packageId,
      scheduledAt,
    });

    const conflicts = await findBookingConflicts({
      creatorId,
      fanId: user.id,
      scheduledAt,
      duration: bookingSelection.package.duration,
    });

    if (conflicts.length > 0) {
      throw new Error("That time is no longer available.");
    }

    const { data: existingBooking } = await serviceSupabase
      .from("bookings")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ error: "This payment has already been used for a booking." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const expectedAmountCents = Math.round(Number(bookingSelection.package.price) * 1.025 * 100);

    if (paymentIntent.metadata?.userId !== user.id) {
      throw new Error("This payment does not belong to the signed-in fan.");
    }
    if (paymentIntent.amount !== expectedAmountCents) {
      throw new Error("Payment amount does not match this booking.");
    }
    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not completed yet.");
    }

    const bookingPrice = roundCurrency(expectedAmountCents / 100);
    const { data: booking, error: insertError } = await serviceSupabase
      .from("bookings")
      .insert({
        creator_id: creatorId,
        fan_id: user.id,
        package_id: packageId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration: bookingSelection.package.duration,
        price: bookingPrice,
        status: "upcoming",
        topic: topic || null,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("*")
      .single();

    if (insertError || !booking) {
      throw new Error("Could not create booking.");
    }

    return NextResponse.json({ booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create booking.";

    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === "succeeded") {
          await refundPaymentIntent({
            paymentIntentId,
            amountToRefundCents: paymentIntent.amount,
          });
        }
      } catch {
        // Best effort refund on failed booking creation.
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
