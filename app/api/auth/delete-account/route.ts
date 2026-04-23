import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";

async function cleanupStripeResources(userId: string) {
  // Best-effort Stripe cleanup. Failures here must not block the auth
  // deletion — the user can always be fully scrubbed from Stripe later via
  // the dashboard, and leaving auth.users behind because Stripe 500'd would
  // be worse for the user asking to be forgotten.
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("stripe_connect_account_id")
    .eq("id", userId)
    .maybeSingle();

  const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (customerId) {
    try {
      await stripe.customers.del(customerId);
    } catch (err) {
      console.warn(
        "[delete-account] Could not delete Stripe customer",
        customerId,
        err instanceof Error ? err.message : err
      );
    }
  }

  const connectAccountId = (creatorProfile as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id;
  if (connectAccountId) {
    try {
      await stripe.accounts.del(connectAccountId);
    } catch (err) {
      // Stripe refuses to delete Connect accounts with non-zero balance or
      // pending payouts; those need manual reconciliation.
      console.warn(
        "[delete-account] Could not delete Stripe Connect account",
        connectAccountId,
        err instanceof Error ? err.message : err
      );
    }
  }
}

export async function POST() {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scrub Stripe before Supabase — once auth.users is gone, the row-level
    // references we need to locate the Stripe resources are gone too.
    await cleanupStripeResources(user.id);

    const { error } = await serviceSupabase.auth.admin.deleteUser(user.id);
    if (error) {
      return NextResponse.json({ error: error.message || "Could not delete account." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete account." },
      { status: 500 }
    );
  }
}
