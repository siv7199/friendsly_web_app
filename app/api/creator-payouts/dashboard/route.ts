import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireCreatorUser } from "@/lib/server/authz";
import { stripe } from "@/lib/server/stripe";
import { syncStripeConnectAccountStatus } from "@/lib/server/payouts";

export async function POST() {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireCreatorUser(serviceSupabase, user.id);
    } catch {
      return NextResponse.json({ error: "Only creators can manage payouts." }, { status: 403 });
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
