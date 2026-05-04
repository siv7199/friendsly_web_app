import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";
import {
  getLivePreauthAmount,
  getLivePreauthFanChargeAmount,
  getLivePreauthFanChargeAmountCents,
  isValidLiveJoinFee,
  normalizeLiveJoinFee,
} from "@/lib/live";
import {
  checkRateLimit,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const serviceSupabase = createServiceClient();
    const limited = checkRateLimit(request, "public-live-preauth", {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const creatorId = stringField(body, "creatorId", 80);
    const sessionId = stringField(body, "currentSessionId", 80);
    const creatorName = stringField(body, "creatorName", 120);

    if (!isUuid(creatorId) || !isUuid(sessionId)) {
      return NextResponse.json({ error: "Missing live join details." }, { status: 400 });
    }

    const { data: liveSession } = await serviceSupabase
      .from("live_sessions")
      .select("id, creator_id, join_fee, is_active, daily_room_url")
      .eq("id", sessionId)
      .eq("creator_id", creatorId)
      .eq("is_active", true)
      .not("daily_room_url", "is", null)
      .maybeSingle();

    if (!liveSession) {
      return NextResponse.json({ error: "Creator is offline or not accepting live joins." }, { status: 400 });
    }

    const joinFee = normalizeLiveJoinFee(liveSession.join_fee);
    if (!isValidLiveJoinFee(joinFee)) {
      return NextResponse.json({ error: "Invalid amount per minute." }, { status: 400 });
    }

    const preauthAmount = getLivePreauthAmount(joinFee);
    const preauthFanCharge = getLivePreauthFanChargeAmount(joinFee);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: getLivePreauthFanChargeAmountCents(joinFee),
      currency: "usd",
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      description: `Guest live call hold - ${creatorName || "Creator"}`,
      metadata: {
        checkoutType: "guest_live_queue",
        type: "live_call_hold",
        creator_name: creatorName,
        creator_id: creatorId,
        live_session_id: sessionId,
        live_rate_per_minute: String(joinFee),
        hold_minutes: "5",
        hold_amount: String(preauthAmount),
        fan_hold_amount: String(preauthFanCharge),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not initialise live payment." },
      { status: 400 }
    );
  }
}
