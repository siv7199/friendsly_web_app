import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";
import {
  getLivePreauthAmount,
  getLivePreauthAmountCents,
  isValidLiveJoinFee,
  normalizeLiveJoinFee,
} from "@/lib/live";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      ratePerMinute,
      creatorName,
      saveForFuture,
      paymentMethodId,
    } = body;

    if (!isValidLiveJoinFee(ratePerMinute)) {
      return NextResponse.json({ error: "Invalid amount per minute." }, { status: 400 });
    }

    const joinFee = normalizeLiveJoinFee(ratePerMinute);
    const amount = getLivePreauthAmountCents(joinFee);
    const preauthAmount = getLivePreauthAmount(joinFee);
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
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: `Live call hold - ${creatorName}`,
        metadata: {
          type: "live_call_hold",
          creator_name: creatorName,
          live_rate_per_minute: String(joinFee),
          hold_minutes: "5",
          hold_amount: String(preauthAmount),
          user_id: user.id,
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
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      setup_future_usage: saveForFuture ? "off_session" : undefined,
      description: `Live call hold - ${creatorName}`,
      metadata: {
        type: "live_call_hold",
        creator_name: creatorName,
        live_rate_per_minute: String(joinFee),
        hold_minutes: "5",
        hold_amount: String(preauthAmount),
        user_id: user.id,
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
