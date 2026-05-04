import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent, stripe } from "@/lib/server/stripe";
import { getLivePreauthAmount, getLivePreauthFanChargeAmountCents, normalizeLiveJoinFee } from "@/lib/live";
import {
  checkRateLimit,
  isPaymentIntentId,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

function isValidGuestPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function POST(request: Request) {
  const serviceSupabase = createServiceClient();
  let paymentIntentId: string | null = null;
  let createdUserId: string | null = null;

  const limited = checkRateLimit(request, "public-live-join-queue", {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const sessionId = stringField(body, "sessionId", 80);
    const fullName = stringField(body, "fullName", 120);
    const email = stringField(body, "email", 254).toLowerCase();
    const password = stringField(body, "password", 200);
    paymentIntentId = stringField(body, "paymentIntentId", 120) || null;

    if (!isUuid(sessionId) || !paymentIntentId || !isPaymentIntentId(paymentIntentId)) {
      return NextResponse.json({ error: "Missing live join details." }, { status: 400 });
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
      throw new Error("An account already exists for this email. Sign in to join the live queue.");
    }

    const { data: liveSession } = await serviceSupabase
      .from("live_sessions")
      .select("id, creator_id, join_fee, is_active, daily_room_url")
      .eq("id", sessionId)
      .eq("is_active", true)
      .not("daily_room_url", "is", null)
      .maybeSingle();

    if (!liveSession) {
      throw new Error("Creator is offline or this live is unavailable.");
    }

    const joinFee = normalizeLiveJoinFee(liveSession.join_fee);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = paymentIntent.metadata ?? {};
    const expectedAmountCents = getLivePreauthFanChargeAmountCents(joinFee);

    if (metadata.checkoutType !== "guest_live_queue") {
      throw new Error("This payment was not created for guest live checkout.");
    }
    if (metadata.creator_id !== liveSession.creator_id || metadata.live_session_id !== sessionId) {
      throw new Error("Payment details do not match this live queue.");
    }
    if (paymentIntent.amount !== expectedAmountCents) {
      throw new Error("Payment amount does not match this live join.");
    }
    if (!["requires_capture", "succeeded"].includes(paymentIntent.status)) {
      throw new Error("Live join payment has not completed yet.");
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

    const { data: existingEntry } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("fan_id", createdUserId)
      .in("status", ["waiting", "active"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingEntry) {
      return NextResponse.json({ queueEntry: existingEntry, alreadyQueued: true });
    }

    const { data: queueEntry, error: insertError } = await serviceSupabase
      .from("live_queue_entries")
      .insert({
        session_id: sessionId,
        fan_id: createdUserId,
        status: "waiting",
        position: 0,
        amount_pre_authorized: getLivePreauthAmount(joinFee),
        amount_charged: null,
        stripe_pre_auth_id: paymentIntentId,
        joined_at: new Date().toISOString(),
      })
      .select("id, status")
      .single();

    if (insertError || !queueEntry) {
      throw new Error("Could not join the live queue.");
    }

    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...metadata,
          user_id: createdUserId,
          user_email: email,
          queue_entry_id: queueEntry.id,
        },
      });
    } catch {
      // Metadata enrichment should not undo a confirmed queue join.
    }

    return NextResponse.json({ queueEntry, alreadyQueued: false, userId: createdUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join the live queue.";

    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        await refundPaymentIntent({
          paymentIntentId,
          amountToRefundCents: paymentIntent.amount,
        });
      } catch {
        // Best effort release/refund on failed guest queue join.
      }
    }

    if (createdUserId) {
      try {
        await serviceSupabase.auth.admin.deleteUser(createdUserId);
      } catch {
        // Best effort account cleanup.
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
