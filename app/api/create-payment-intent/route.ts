import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";
import {
  booleanField,
  checkRateLimit,
  isPaymentMethodId,
  isSafeMoneyCents,
  isUuid,
  numberField,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "create-payment-intent", {
      key: user.id,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    let amount = numberField(body, "amount");
    const packageId = stringField(body, "packageId", 80);
    const creatorName = stringField(body, "creatorName", 120);
    const packageName = stringField(body, "packageName", 120);
    const saveForFuture = booleanField(body, "saveForFuture");
    const paymentMethodId = stringField(body, "paymentMethodId", 120);

    // Require a valid packageId. This is the only trusted source of truth for
    // the charge amount; accepting a raw client `amount` would let a caller
    // pick arbitrary prices within the safe-money band (e.g. $0.50 to
    // $5,000) and charge saved cards via off_session=true without ever
    // completing a booking.
    if (!packageId || !isUuid(packageId)) {
      return NextResponse.json(
        { error: "packageId is required." },
        { status: 400 }
      );
    }

    const { data: pkg } = await supabase
      .from("call_packages")
      .select("price")
      .eq("id", packageId)
      .maybeSingle();

    if (!pkg?.price) {
      return NextResponse.json(
        { error: "Package not found." },
        { status: 400 }
      );
    }

    amount = Math.round(Number(pkg.price) * 1.025 * 100);

    if (!isSafeMoneyCents(amount, 500_000)) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum charge is $0.50." },
        { status: 400 }
      );
    }

    if (!creatorName || !packageName) {
      return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
    }

    if (paymentMethodId && !isPaymentMethodId(paymentMethodId)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
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
        amount: amount!,
        currency: "usd",
        customer: customerId,
        receipt_email: user.email ?? undefined,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Friendsly: ${packageName} with ${creatorName}`,
        metadata: {
          creatorName,
          packageName,
          userId: user.id,
          userEmail: user.email ?? "",
        },
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount!,
      currency: "usd",
      customer: customerId,
      receipt_email: user.email ?? undefined,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: saveForFuture ? "off_session" : undefined,
      description: `Friendsly: ${packageName} with ${creatorName}`,
      metadata: {
        creatorName,
        packageName,
        userId: user.id,
        userEmail: user.email ?? "",
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
