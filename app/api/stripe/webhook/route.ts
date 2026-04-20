import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.warn("[stripe-webhook] Missing signature or webhook secret.");
    return NextResponse.json({ error: "Missing Stripe webhook configuration." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    console.warn("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const userId = typeof account.metadata?.user_id === "string" ? account.metadata.user_id : null;

      if (userId) {
        const supabase = createServiceClient();
        await supabase
          .from("creator_profiles")
          .update({
            stripe_connect_details_submitted: Boolean(account.details_submitted),
            stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
            stripe_connect_charges_enabled: Boolean(account.charges_enabled),
          })
          .eq("id", userId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    console.error("[stripe-webhook] Processing failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
