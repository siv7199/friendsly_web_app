import { createServiceClient } from "@/lib/supabase/server";
import { deriveBookingStatus, getBookingGrossAmount } from "@/lib/bookings";
import { stripe } from "@/lib/server/stripe";
import { getRetainedBookingAmount } from "@/lib/server/bookings";
import { getCreatorRevenueShare } from "@/lib/revenue";

export type CreatorPayoutSummary = {
  available: number;
  stripeAvailable: number;
  withdrawable: number;
  pending: number;
  pendingPayouts: number;
  thisMonth: number;
  totalEarned: number;
};

export type CreatorStripeConnectStatus = {
  accountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function mapStripePayoutStatus(status: string | null | undefined) {
  if (status === "paid") return "completed";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

export async function getPlatformStripeAvailableBalance() {
  const balance = await stripe.balance.retrieve();
  const usdAvailable = (balance.available || []).find((entry) => entry.currency === "usd");
  return roundCurrency(Math.max(0, (usdAvailable?.amount ?? 0) / 100));
}

export async function syncStripeConnectAccountStatus(userId: string): Promise<CreatorStripeConnectStatus> {
  const supabase = createServiceClient();
  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("stripe_connect_account_id, stripe_connect_details_submitted, stripe_connect_payouts_enabled, stripe_connect_charges_enabled")
    .eq("id", userId)
    .single();

  if (!creatorProfile?.stripe_connect_account_id) {
    return {
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
    };
  }

  const account = await stripe.accounts.retrieve(creatorProfile.stripe_connect_account_id);
  const nextStatus: CreatorStripeConnectStatus = {
    accountId: account.id,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
  };

  await supabase
    .from("creator_profiles")
    .update({
      stripe_connect_details_submitted: nextStatus.detailsSubmitted,
      stripe_connect_payouts_enabled: nextStatus.payoutsEnabled,
      stripe_connect_charges_enabled: nextStatus.chargesEnabled,
    })
    .eq("id", userId);

  return nextStatus;
}

export async function getOrCreateStripeConnectAccount(params: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
}) {
  const { userId, email, fullName } = params;
  const supabase = createServiceClient();

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("stripe_connect_account_id")
    .eq("id", userId)
    .single();

  if (creatorProfile?.stripe_connect_account_id) {
    return creatorProfile.stripe_connect_account_id as string;
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: email ?? undefined,
    business_type: "individual",
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      user_id: userId,
      full_name: fullName ?? "",
    },
  });

  await supabase
    .from("creator_profiles")
    .upsert({
      id: userId,
      stripe_connect_account_id: account.id,
      stripe_connect_details_submitted: Boolean(account.details_submitted),
      stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_connect_charges_enabled: Boolean(account.charges_enabled),
    }, { onConflict: "id" });

  return account.id;
}

export async function syncCreatorPayoutRows(userId: string) {
  const supabase = createServiceClient();
  const connectStatus = await syncStripeConnectAccountStatus(userId);

  if (!connectStatus.accountId) {
    return connectStatus;
  }

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, stripe_id")
    .eq("creator_id", userId)
    .not("stripe_id", "is", null)
    .in("status", ["pending", "processing"]);

  for (const payout of payouts ?? []) {
    try {
      const stripePayout = await stripe.payouts.retrieve(String(payout.stripe_id), {
        stripeAccount: connectStatus.accountId,
      });

      await supabase
        .from("payouts")
        .update({
          status: mapStripePayoutStatus(stripePayout.status),
          failure_reason: stripePayout.failure_message ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout.id);
    } catch {
      // Ignore sync failures so the page can still load.
    }
  }

  return connectStatus;
}

export async function getCreatorPayoutSummary(userId: string): Promise<CreatorPayoutSummary> {
  const supabase = createServiceClient();
  const [bookingsRes, payoutsRes, liveRes, stripeAvailable] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, price, scheduled_at, duration, status, creator_present, fan_present, refund_amount, late_fee_amount, late_fee_paid_at")
      .eq("creator_id", userId),
    supabase
      .from("payouts")
      .select("amount, status")
      .eq("creator_id", userId),
    supabase
      .from("live_sessions")
      .select("id, live_queue_entries(id, status, amount_charged, ended_at)")
      .eq("creator_id", userId),
    getPlatformStripeAvailableBalance(),
  ]);

  let totalEarned = 0;
  let pendingEarnings = 0;
  let thisMonth = 0;
  const now = new Date();

  (bookingsRes.data || []).forEach((booking: any) => {
    const grossBookingAmount = getBookingGrossAmount(
      Number(booking.price),
      booking.late_fee_amount,
      booking.late_fee_paid_at
    );
    const normalizedStatus = deriveBookingStatus(
      booking.status,
      booking.scheduled_at,
      booking.duration,
      now,
      booking.creator_present,
      booking.fan_present
    );

    if (normalizedStatus === "upcoming" || normalizedStatus === "live") {
      pendingEarnings += getCreatorRevenueShare(grossBookingAmount);
      return;
    }

    const grossRetained = normalizedStatus === "completed"
      ? grossBookingAmount
      : normalizedStatus === "cancelled"
      ? getRetainedBookingAmount(grossBookingAmount, booking.refund_amount)
      : 0;

    if (grossRetained <= 0) return;

    const creatorCut = getCreatorRevenueShare(grossRetained);
    totalEarned += creatorCut;

    const scheduledDate = new Date(booking.scheduled_at);
    if (
      scheduledDate.getMonth() === now.getMonth() &&
      scheduledDate.getFullYear() === now.getFullYear()
    ) {
      thisMonth += creatorCut;
    }
  });

  (liveRes.data || []).forEach((session: any) => {
    (session.live_queue_entries || []).forEach((entry: any) => {
      if ((entry.status === "completed" || entry.status === "skipped") && entry.amount_charged) {
        const creatorCut = getCreatorRevenueShare(Number(entry.amount_charged));
        totalEarned += creatorCut;

        const endedAt = entry.ended_at ? new Date(entry.ended_at) : null;
        if (endedAt && endedAt.getMonth() === now.getMonth() && endedAt.getFullYear() === now.getFullYear()) {
          thisMonth += creatorCut;
        }
      }
    });
  });

  let pendingPayouts = 0;
  let withdrawn = 0;

  (payoutsRes.data || []).forEach((payout: any) => {
    if (payout.status === "pending" || payout.status === "processing") {
      pendingPayouts += Number(payout.amount);
    }
    if (payout.status === "completed") {
      withdrawn += Number(payout.amount);
    }
  });

  const ledgerAvailable = roundCurrency(Math.max(0, totalEarned - withdrawn - pendingPayouts));

  return {
    available: ledgerAvailable,
    stripeAvailable,
    withdrawable: roundCurrency(Math.max(0, Math.min(ledgerAvailable, stripeAvailable))),
    pending: roundCurrency(pendingEarnings),
    pendingPayouts: roundCurrency(pendingPayouts),
    thisMonth: roundCurrency(thisMonth),
    totalEarned: roundCurrency(totalEarned),
  };
}
