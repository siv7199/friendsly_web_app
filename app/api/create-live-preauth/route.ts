/**
 * POST /api/create-live-preauth
 *
 * Creates a Stripe PaymentIntent in "manual" capture mode (pre-authorization).
 * The card is held but NOT charged immediately.
 *
 * After the live call ends, the server captures the actual amount based on
 * duration_seconds * rate_per_minute and cancels the remainder.
 *
 * Body: { ratePerMinute: number, creatorName: string, preAuthMinutes?: number }
 * Response: { clientSecret: string, paymentIntentId: string }
 */

import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

// We pre-authorize for this many minutes by default.
// The actual charge is calculated when the creator skips the fan.
const DEFAULT_PREAUTH_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ratePerMinute, creatorName, preAuthMinutes = DEFAULT_PREAUTH_MINUTES } = body;

    if (!ratePerMinute || ratePerMinute <= 0) {
      return NextResponse.json({ error: "Invalid rate." }, { status: 400 });
    }

    const preAuthAmount = Math.round(ratePerMinute * preAuthMinutes * 100); // cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: preAuthAmount,
      currency: "usd",
      capture_method: "manual",          // hold funds, don't charge yet
      automatic_payment_methods: { enabled: true },
      description: `Live queue — ${creatorName} @ $${ratePerMinute}/min`,
      metadata: {
        type: "live_preauth",
        creator_name: creatorName,
        rate_per_minute: String(ratePerMinute),
        pre_auth_minutes: String(preAuthMinutes),
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
