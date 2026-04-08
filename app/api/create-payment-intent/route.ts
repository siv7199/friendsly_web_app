import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, creatorName, packageName, saveForFuture, paymentMethodId } = await request.json();

    if (!amount || typeof amount !== "number" || amount < 50) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum charge is $0.50." },
        { status: 400 }
      );
    }

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
        description: `Friendsly: ${packageName} with ${creatorName}`,
        metadata: {
          creatorName,
          packageName,
          userId: user.id,
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
      automatic_payment_methods: { enabled: true },
      setup_future_usage: saveForFuture ? "off_session" : undefined,
      description: `Friendsly: ${packageName} with ${creatorName}`,
      metadata: {
        creatorName,
        packageName,
        userId: user.id,
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
