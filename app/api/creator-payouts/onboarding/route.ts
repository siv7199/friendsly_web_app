import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireCreatorUser } from "@/lib/server/authz";
import { getOrCreateStripeConnectAccount, syncStripeConnectAccountStatus } from "@/lib/server/payouts";
import { stripe } from "@/lib/server/stripe";
import { checkRateLimit } from "@/lib/server/request-security";

export async function POST(request: Request) {
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
      return NextResponse.json({ error: "Only creators can set up payouts." }, { status: 403 });
    }

    const limited = checkRateLimit(request, "creator-payout-onboarding", {
      key: user.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const accountId = await getOrCreateStripeConnectAccount({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    });

    const currentStatus = await syncStripeConnectAccountStatus(user.id);
    if (currentStatus.detailsSubmitted && currentStatus.payoutsEnabled) {
      return NextResponse.json({ url: null, account: currentStatus });
    }

    const origin = new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/earnings?stripe=refresh`,
      return_url: `${origin}/earnings?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
      account: currentStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
