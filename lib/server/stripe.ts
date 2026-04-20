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
    const updates: Stripe.CustomerUpdateParams = {};
    const normalizedEmail = email?.trim().toLowerCase() ?? null;
    const normalizedName = fullName?.trim() ?? null;

    if (normalizedEmail) {
      updates.email = normalizedEmail;
    }
    if (normalizedName) {
      updates.name = normalizedName;
    }
    updates.metadata = {
      user_id: userId,
      app_email: normalizedEmail ?? "",
    };

    await stripe.customers.update(profile.stripe_customer_id as string, updates);
    return profile.stripe_customer_id as string;
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  const normalizedName = fullName?.trim() ?? null;
  const customer = await stripe.customers.create({
    email: normalizedEmail ?? undefined,
    name: normalizedName ?? undefined,
    metadata: {
      user_id: userId,
      app_email: normalizedEmail ?? "",
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

export async function refundPaymentIntent(params: {
  paymentIntentId: string;
  amountToRefundCents: number;
}) {
  const { paymentIntentId, amountToRefundCents } = params;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const refundAmount = Math.max(0, Math.round(amountToRefundCents));

  if (refundAmount <= 0) {
    return {
      refundId: null,
      refundedAmount: 0,
      status: paymentIntent.status,
    };
  }

  if (paymentIntent.status === "requires_capture") {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return {
      refundId: null,
      refundedAmount: refundAmount,
      status: "canceled",
    };
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment is not in a refundable state.");
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: refundAmount,
  });

  return {
    refundId: refund.id,
    refundedAmount: refundAmount,
    status: refund.status,
  };
}
