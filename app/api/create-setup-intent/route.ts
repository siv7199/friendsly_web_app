/**
 * POST /api/create-setup-intent
 *
 * Creates a Stripe SetupIntent — used to save a card WITHOUT charging it.
 * The browser uses the returned client_secret with Stripe Elements to
 * collect and tokenize card details. Stripe stores the PaymentMethod;
 * we get back a PaymentMethod ID to save against the user.
 *
 * Body: { customerId?: string }  (optional — if omitted Stripe creates an anonymous PM)
 *
 * → Future production: create/retrieve a real Stripe Customer for each user
 *   and attach the PaymentMethod to that customer so it can be reused.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST() {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      usage: "off_session", // allows charging later without the customer present
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
