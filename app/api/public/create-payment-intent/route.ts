import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";

export async function POST(request: Request) {
  try {
    const { guestCheckoutSessionId } = await request.json();
    const sessionId = String(guestCheckoutSessionId ?? "");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing guest checkout session." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from("guest_checkout_sessions")
      .select(`
        id,
        scheduled_at,
        status,
        creator:profiles!creator_id(full_name),
        package:call_packages!package_id(id, name, price),
        guest:guest_contacts!guest_contact_id(full_name, email)
      `)
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Guest checkout session not found." }, { status: 404 });
    }

    if (session.status !== "pending") {
      return NextResponse.json({ error: "Guest checkout session is no longer active." }, { status: 400 });
    }

    const packagePrice = Number((session as any).package?.price ?? 0);
    const amount = Math.round(packagePrice * 1.025 * 100);
    if (amount < 50) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: (session as any).guest?.email ?? undefined,
      description: `Friendsly: ${(session as any).package?.name ?? "Call"} with ${(session as any).creator?.full_name ?? "Creator"}`,
      metadata: {
        flowType: "guest_booking",
        guestCheckoutSessionId: session.id,
        creatorName: (session as any).creator?.full_name ?? "",
        packageName: (session as any).package?.name ?? "",
      },
    });

    await supabase
      .from("guest_checkout_sessions")
      .update({ payment_intent_id: paymentIntent.id })
      .eq("id", sessionId);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create payment intent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
