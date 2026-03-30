/**
 * POST /api/create-payment-intent
 *
 * Creates a Stripe PaymentIntent server-side and returns the client_secret
 * to the browser. The browser then uses that secret with Stripe Elements to
 * collect and confirm payment — the card number never touches our server.
 *
 * Body: { amount: number, creatorName: string, packageName: string }
 * amount is in cents (e.g. $25.00 → 2500)
 *
 * → Future production: also create a booking record in Supabase here,
 *   and use a Stripe webhook to mark it "paid" after confirmation.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(request: Request) {
  try {
    const { amount, creatorName, packageName } = await request.json();

    if (!amount || typeof amount !== "number" || amount < 50) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum charge is $0.50." },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,          // in cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Friendsly: ${packageName} with ${creatorName}`,
      metadata: {
        creatorName,
        packageName,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
