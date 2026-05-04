import { NextResponse } from "next/server";
import { validateBookingSelection } from "@/lib/server/bookings";
import { stripe } from "@/lib/server/stripe";
import {
  checkRateLimit,
  isIsoDate,
  isSafeMoneyCents,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "public-create-payment-intent", {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const creatorId = stringField(body, "creatorId", 80);
    const packageId = stringField(body, "packageId", 80);
    const scheduledAt = stringField(body, "scheduledAt", 80);
    const creatorName = stringField(body, "creatorName", 120);
    const packageName = stringField(body, "packageName", 120);

    if (!isUuid(creatorId) || !isUuid(packageId) || !isIsoDate(scheduledAt)) {
      return NextResponse.json({ error: "Missing booking details." }, { status: 400 });
    }

    const bookingSelection = await validateBookingSelection({
      creatorId,
      packageId,
      scheduledAt,
    });

    const amount = Math.round(Number(bookingSelection.package.price) * 1.025 * 100);
    if (!isSafeMoneyCents(amount, 500_000)) {
      return NextResponse.json({ error: "Invalid amount. Minimum charge is $0.50." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Friendsly guest checkout: ${packageName || bookingSelection.package.name} with ${creatorName || "Creator"}`,
      metadata: {
        checkoutType: "guest_booking",
        creatorId,
        packageId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        packageName: packageName || bookingSelection.package.name,
        creatorName,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not initialise payment." },
      { status: 400 }
    );
  }
}
