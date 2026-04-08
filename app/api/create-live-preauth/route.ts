import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";

const DEFAULT_PREAUTH_MINUTES = 10;

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
      preAuthMinutes = DEFAULT_PREAUTH_MINUTES,
      saveForFuture,
      paymentMethodId,
    } = body;

    if (!ratePerMinute || ratePerMinute <= 0) {
      return NextResponse.json({ error: "Invalid rate." }, { status: 400 });
    }

    const preAuthAmount = Math.round(ratePerMinute * preAuthMinutes * 100);
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
        amount: preAuthAmount,
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethodId,
        capture_method: "manual",
        off_session: true,
        confirm: true,
        description: `Live queue - ${creatorName} @ $${ratePerMinute}/min`,
        metadata: {
          type: "live_preauth",
          creator_name: creatorName,
          rate_per_minute: String(ratePerMinute),
          pre_auth_minutes: String(preAuthMinutes),
          user_id: user.id,
        },
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: preAuthAmount,
      currency: "usd",
      customer: customerId,
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      setup_future_usage: saveForFuture ? "off_session" : undefined,
      description: `Live queue - ${creatorName} @ $${ratePerMinute}/min`,
      metadata: {
        type: "live_preauth",
        creator_name: creatorName,
        rate_per_minute: String(ratePerMinute),
        pre_auth_minutes: String(preAuthMinutes),
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
