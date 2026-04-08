import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, stripe } from "@/lib/server/stripe";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
