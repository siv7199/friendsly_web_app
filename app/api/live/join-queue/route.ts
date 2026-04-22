import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getLivePreauthAmount, getLivePreauthFanChargeAmountCents, normalizeLiveJoinFee } from "@/lib/live";
import { stripe } from "@/lib/server/stripe";
import {
  checkRateLimit,
  isPaymentIntentId,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "live-join-queue", {
      key: user.id,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const sessionId = stringField(body, "sessionId", 80);
    const paymentIntentId = stringField(body, "paymentIntentId", 120);

    if (!isUuid(sessionId) || !isPaymentIntentId(paymentIntentId)) {
      return NextResponse.json({ error: "Missing live join details." }, { status: 400 });
    }

    const { data: existingEntry } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("fan_id", user.id)
      .in("status", ["waiting", "active"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingEntry) {
      return NextResponse.json({ queueEntry: existingEntry, alreadyQueued: true });
    }

    const { data: liveSession } = await serviceSupabase
      .from("live_sessions")
      .select("id, creator_id, join_fee, is_active, daily_room_url")
      .eq("id", sessionId)
      .eq("is_active", true)
      .not("daily_room_url", "is", null)
      .maybeSingle();

    if (!liveSession) {
      return NextResponse.json({ error: "Creator is offline or this live is unavailable." }, { status: 400 });
    }

    const joinFee = normalizeLiveJoinFee(liveSession.join_fee);
    if (joinFee <= 0) {
      return NextResponse.json({ error: "This live is not accepting paid queue joins." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const expectedAmountCents = getLivePreauthFanChargeAmountCents(joinFee);
    const paymentOwnerId = paymentIntent.metadata?.user_id ?? paymentIntent.metadata?.userId ?? null;
    const paymentCreatorId = paymentIntent.metadata?.creator_id ?? null;
    const paymentSessionId = paymentIntent.metadata?.live_session_id ?? null;

    if (paymentOwnerId !== user.id) {
      return NextResponse.json({ error: "This payment does not belong to the signed-in fan." }, { status: 403 });
    }

    if (paymentCreatorId && paymentCreatorId !== liveSession.creator_id) {
      return NextResponse.json({ error: "This payment was created for a different creator." }, { status: 400 });
    }

    if (paymentSessionId && paymentSessionId !== sessionId) {
      return NextResponse.json({ error: "This payment was created for a different live session." }, { status: 400 });
    }

    if (paymentIntent.amount !== expectedAmountCents) {
      return NextResponse.json({ error: "Payment amount does not match this live join." }, { status: 400 });
    }

    if (!["requires_capture", "succeeded"].includes(paymentIntent.status)) {
      return NextResponse.json({ error: "Live join payment has not completed yet." }, { status: 400 });
    }

    const { data: queueEntry, error: insertError } = await serviceSupabase
      .from("live_queue_entries")
      .insert({
        session_id: sessionId,
        fan_id: user.id,
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
      return NextResponse.json({ error: "Could not join the live queue." }, { status: 400 });
    }

    return NextResponse.json({ queueEntry, alreadyQueued: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join the live queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
