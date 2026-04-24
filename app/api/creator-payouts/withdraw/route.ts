import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireCreatorUser } from "@/lib/server/authz";
import { getCreatorPayoutSummary, syncStripeConnectAccountStatus } from "@/lib/server/payouts";
import { checkRateLimit, numberField, readJsonBody } from "@/lib/server/request-security";

function getFunctionsBaseUrl(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    return `${url.origin}/functions/v1`;
  } catch {
    return null;
  }
}

async function notifyPayoutRequest(details: {
  payoutId: string;
  reviewToken: string;
  creatorName: string;
  creatorEmail: string;
  amount: number;
  withdrawableAtRequest: number;
  stripeConnectAccountId: string;
  requestedAt: string;
}) {
  const functionsBaseUrl = getFunctionsBaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!functionsBaseUrl || !serviceRoleKey) {
    return { attempted: false, delivered: false, reason: "missing_function_config" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${functionsBaseUrl}/payout-request-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(details),
      signal: controller.signal,
    });

    const responseJson = await response.json().catch(() => null);
    clearTimeout(timeoutId);

    return {
      attempted: true,
      delivered: Boolean(response.ok && responseJson?.delivered),
      reason:
        response.ok && responseJson?.delivered
          ? null
          : typeof responseJson?.reason === "string"
            ? responseJson.reason
            : `function_status_${response.status}`,
    };
  } catch (error) {
    console.warn("creator-payout-withdraw: Notification fetch error or timeout", error);
    return {
      attempted: true,
      delivered: false,
      reason: error instanceof Error ? error.name || "fetch_failed" : "fetch_failed",
    };
  }
}

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
      return NextResponse.json({ error: "Only creators can withdraw payouts." }, { status: 403 });
    }

    const limited = checkRateLimit(request, "creator-payout-withdraw", {
      key: user.id,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const requestedAmount = numberField(body, "amount");
    if (!requestedAmount || requestedAmount <= 0 || requestedAmount > 100_000) {
      return NextResponse.json({ error: "Invalid withdrawal amount." }, { status: 400 });
    }

    const account = await syncStripeConnectAccountStatus(user.id);
    if (!account.accountId || !account.payoutsEnabled) {
      return NextResponse.json({ error: "Finish Stripe payout setup before withdrawing." }, { status: 400 });
    }

    const summary = await getCreatorPayoutSummary(user.id);
    if (requestedAmount > summary.withdrawable + 0.001) {
      return NextResponse.json({
        error: `You can withdraw up to $${summary.withdrawable.toFixed(2)} right now based on Stripe's available balance.`,
      }, { status: 400 });
    }

    const { data: existingProcessingPayout } = await serviceSupabase
      .from("payouts")
      .select("id")
      .eq("creator_id", user.id)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();

    if (existingProcessingPayout) {
      return NextResponse.json({ error: "A payout request is already pending. Please wait for it to be reviewed before withdrawing again." }, { status: 400 });
    }

    const { data: payoutRow, error: insertError } = await serviceSupabase
      .from("payouts")
      .insert({
        creator_id: user.id,
        amount: requestedAmount,
        status: "pending",
        requested_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !payoutRow) {
      return NextResponse.json({ error: "Could not create payout record." }, { status: 500 });
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const emailResult = await notifyPayoutRequest({
      payoutId: payoutRow.id,
      reviewToken: String(payoutRow.review_token ?? ""),
      creatorName: profile?.full_name ?? user.user_metadata?.full_name ?? "Creator",
      creatorEmail: profile?.email ?? user.email ?? "",
      amount: requestedAmount,
      withdrawableAtRequest: summary.withdrawable,
      stripeConnectAccountId: account.accountId,
      requestedAt: payoutRow.requested_at ?? payoutRow.created_at ?? new Date().toISOString(),
    });

    if (!emailResult.delivered) {
      console.warn("creator-payout-withdraw: Email notification not delivered", {
        configured: emailResult.attempted,
        reason: emailResult.reason ?? "unknown",
        payoutId: payoutRow.id,
      });
    }

    return NextResponse.json({
      payout: payoutRow,
      emailNotificationSent: emailResult.delivered,
      emailNotificationConfigured: emailResult.attempted,
      emailNotificationReason: emailResult.reason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
