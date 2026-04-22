import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";
import {
  getLivePreauthAmount,
  getLivePreauthFanChargeAmount,
  getLivePreauthFanChargeAmountCents,
  isValidLiveJoinFee,
  normalizeLiveJoinFee,
} from "@/lib/live";
import {
  booleanField,
  checkRateLimit,
  isPaymentMethodId,
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

    const limited = checkRateLimit(request, "create-live-preauth", {
      key: user.id,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const normalizedCreatorId = stringField(body, "creatorId", 80);
    const normalizedSessionId = stringField(body, "currentSessionId", 80);
    const creatorName = stringField(body, "creatorName", 120);
    const saveForFuture = booleanField(body, "saveForFuture");
    const paymentMethodId = stringField(body, "paymentMethodId", 120);

    if (!isUuid(normalizedCreatorId) || (normalizedSessionId && !isUuid(normalizedSessionId))) {
      return NextResponse.json({ error: "Missing creator." }, { status: 400 });
    }

    if (paymentMethodId && !isPaymentMethodId(paymentMethodId)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }

    const { data: creatorProfile } = await serviceSupabase
      .from("creator_profiles")
      .select("id, live_join_fee")
      .eq("id", normalizedCreatorId)
      .maybeSingle();

    const joinFee = normalizeLiveJoinFee(creatorProfile?.live_join_fee);
    if (!isValidLiveJoinFee(joinFee)) {
      return NextResponse.json({ error: "Invalid amount per minute." }, { status: 400 });
    }

    if (normalizedSessionId) {
      const { data: liveSession } = await serviceSupabase
        .from("live_sessions")
        .select("id")
        .eq("id", normalizedSessionId)
        .eq("creator_id", normalizedCreatorId)
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .maybeSingle();

      if (!liveSession) {
        return NextResponse.json({ error: "Creator is offline or not accepting live joins." }, { status: 400 });
      }
    }

    const amount = getLivePreauthFanChargeAmountCents(joinFee);
    const preauthAmount = getLivePreauthAmount(joinFee);
    const preauthFanCharge = getLivePreauthFanChargeAmount(joinFee);
    const shouldUseCustomer = Boolean(saveForFuture || paymentMethodId);
    const customerId = shouldUseCustomer
      ? await ensureStripeCustomer({
          userId: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name ?? null,
        })
      : undefined;

    if (paymentMethodId) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        customer: customerId,
        receipt_email: user.email ?? undefined,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: `Live call hold - ${creatorName}`,
        metadata: {
          type: "live_call_hold",
          creator_name: creatorName,
          creator_id: normalizedCreatorId,
          live_session_id: normalizedSessionId,
          live_rate_per_minute: String(joinFee),
          hold_minutes: "5",
          hold_amount: String(preauthAmount),
          fan_hold_amount: String(preauthFanCharge),
          user_id: user.id,
          user_email: user.email ?? "",
        },
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      receipt_email: user.email ?? undefined,
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      setup_future_usage: saveForFuture ? "off_session" : undefined,
      description: `Live call hold - ${creatorName}`,
      metadata: {
        type: "live_call_hold",
        creator_name: creatorName,
        creator_id: normalizedCreatorId,
        live_session_id: normalizedSessionId,
        live_rate_per_minute: String(joinFee),
        hold_minutes: "5",
        hold_amount: String(preauthAmount),
        fan_hold_amount: String(preauthFanCharge),
        user_id: user.id,
        user_email: user.email ?? "",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
