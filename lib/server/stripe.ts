import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

type EnsureStripeCustomerInput = {
  userId: string;
  email?: string | null;
  fullName?: string | null;
};

export async function ensureStripeCustomer({
  userId,
  email,
  fullName,
}: EnsureStripeCustomerInput) {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: fullName ?? undefined,
    metadata: {
      user_id: userId,
    },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

export async function settleManualCapturePaymentIntent(params: {
  paymentIntentId: string;
  amountToCaptureCents: number;
}) {
  const { paymentIntentId, amountToCaptureCents } = params;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const captureAmount = Math.max(0, Math.round(amountToCaptureCents));
  let refundedAmount = 0;

  if (paymentIntent.status === "requires_capture") {
    if (captureAmount > 0) {
      await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: Math.min(captureAmount, paymentIntent.amount_capturable || paymentIntent.amount),
      });
    } else {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
  } else if (paymentIntent.status === "succeeded") {
    const alreadyCapturedAmount = Number(paymentIntent.amount_received ?? paymentIntent.amount ?? 0);
    const refundAmount = Math.max(0, alreadyCapturedAmount - captureAmount);

    if (refundAmount > 0) {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount,
      });
      refundedAmount = refundAmount;
    }
  }

  return {
    charged: captureAmount > 0,
    refundedAmount,
    status: paymentIntent.status,
  };
}
