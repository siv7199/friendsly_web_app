import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findBookingConflicts, validateBookingSelection } from "@/lib/server/bookings";
import { refundPaymentIntent, stripe } from "@/lib/server/stripe";
import {
  checkRateLimit,
  isIsoDate,
  isPaymentIntentId,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidGuestPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function POST(request: Request) {
  const serviceSupabase = createServiceClient();
  let paymentIntentId: string | null = null;
  let createdUserId: string | null = null;

  const limited = checkRateLimit(request, "public-booking-create", {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const creatorId = stringField(body, "creatorId", 80);
    const packageId = stringField(body, "packageId", 80);
    const scheduledAt = stringField(body, "scheduledAt", 80);
    const topic = stringField(body, "topic", 500);
    const fullName = stringField(body, "fullName", 120);
    const email = stringField(body, "email", 254).toLowerCase();
    const password = stringField(body, "password", 200);
    paymentIntentId = stringField(body, "paymentIntentId", 120) || null;

    if (
      !isUuid(creatorId) ||
      !isUuid(packageId) ||
      !isIsoDate(scheduledAt) ||
      !paymentIntentId ||
      !isPaymentIntentId(paymentIntentId)
    ) {
      return NextResponse.json({ error: "Missing booking details." }, { status: 400 });
    }

    if (!fullName || !email || !email.includes("@") || !isValidGuestPassword(password)) {
      return NextResponse.json({ error: "Enter a valid name, email, and password." }, { status: 400 });
    }

    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      throw new Error("An account already exists for this email. Sign in to finish booking.");
    }

    const bookingSelection = await validateBookingSelection({
      creatorId,
      packageId,
      scheduledAt,
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const expectedAmountCents = Math.round(Number(bookingSelection.package.price) * 1.025 * 100);
    const metadata = paymentIntent.metadata ?? {};

    if (metadata.checkoutType !== "guest_booking") {
      throw new Error("This payment was not created for guest booking checkout.");
    }
    if (metadata.creatorId !== creatorId || metadata.packageId !== packageId) {
      throw new Error("Payment details do not match this booking.");
    }
    if (metadata.scheduledAt && new Date(metadata.scheduledAt).toISOString() !== new Date(scheduledAt).toISOString()) {
      throw new Error("Payment time does not match this booking.");
    }
    if (paymentIntent.amount !== expectedAmountCents) {
      throw new Error("Payment amount does not match this booking.");
    }
    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not completed yet.");
    }

    const { data: existingBooking } = await serviceSupabase
      .from("bookings")
      .select("id, scheduled_at, duration")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ booking: existingBooking, alreadyBooked: true });
    }

    const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "fan",
      },
    });

    if (authError || !authUser.user?.id) {
      throw new Error(authError?.message || "Could not create fan account.");
    }

    createdUserId = authUser.user.id;

    await serviceSupabase
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        role: "fan",
      })
      .eq("id", createdUserId);

    const conflicts = await findBookingConflicts({
      creatorId,
      fanId: createdUserId,
      scheduledAt,
      duration: bookingSelection.package.duration,
    });

    if (conflicts.length > 0) {
      throw new Error("That time is no longer available.");
    }

    const bookingPrice = roundCurrency(expectedAmountCents / 100);
    const { data: booking, error: insertError } = await serviceSupabase
      .from("bookings")
      .insert({
        creator_id: creatorId,
        fan_id: createdUserId,
        package_id: packageId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration: bookingSelection.package.duration,
        price: bookingPrice,
        status: "upcoming",
        topic: topic || null,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("id, creator_id, fan_id, package_id, scheduled_at, duration, price, status, topic, stripe_payment_intent_id")
      .single();

    if (insertError || !booking) {
      throw new Error("Could not create booking.");
    }

    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...metadata,
          userId: createdUserId,
          userEmail: email,
          bookingId: booking.id,
        },
      });
    } catch {
      // Metadata enrichment should not undo a confirmed booking.
    }

    return NextResponse.json({ booking, userId: createdUserId });
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
        // Best effort refund on failed guest booking creation.
      }
    }

    if (createdUserId) {
      try {
        await serviceSupabase.auth.admin.deleteUser(createdUserId);
      } catch {
        // Best effort cleanup when account creation succeeded but booking failed.
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
