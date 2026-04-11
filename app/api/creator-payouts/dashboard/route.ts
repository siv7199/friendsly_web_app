import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";
import { syncStripeConnectAccountStatus } from "@/lib/server/payouts";

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await syncStripeConnectAccountStatus(user.id);
    if (!account.accountId) {
      return NextResponse.json({ error: "Connect a Stripe account first." }, { status: 400 });
    }

    const loginLink = await stripe.accounts.createLoginLink(account.accountId);
    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
