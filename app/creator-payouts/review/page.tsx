import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCreatorPayoutSummary, syncStripeConnectAccountStatus } from "@/lib/server/payouts";
import { stripe } from "@/lib/server/stripe";
import { formatCurrency } from "@/lib/utils";

type ReviewAction = "approve" | "reject";

function normalizeAction(value: string | string[] | undefined): ReviewAction | null {
  const action = Array.isArray(value) ? value[0] : value;
  return action === "approve" || action === "reject" ? action : null;
}

function normalizeToken(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type PayoutReviewRecord = {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  created_at: string;
  requested_at: string | null;
};

type CreatorProfileRecord = {
  full_name: string | null;
  email: string | null;
};

type ReviewLookup =
  | {
      state: "ok";
      payout: PayoutReviewRecord;
      creator: CreatorProfileRecord | null;
    }
  | { state: "error"; title: string; message: string };

async function lookupPayoutRequest(token: string): Promise<ReviewLookup> {
  const supabase = createServiceClient();
  const { data: payout, error } = await supabase
    .from("payouts")
    .select("id, creator_id, amount, status, created_at, requested_at")
    .eq("review_token", token)
    .maybeSingle();

  if (error || !payout) {
    return {
      state: "error",
      title: "Review link invalid",
      message: "We could not find a matching payout request for this review link.",
    };
  }

  if (payout.status !== "pending") {
    return {
      state: "error",
      title: "Payout already reviewed",
      message: `This payout request was already marked as ${payout.status}.`,
    };
  }

  const { data: creator } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", payout.creator_id)
    .maybeSingle();

  return {
    state: "ok",
    payout: payout as PayoutReviewRecord,
    creator: creator as CreatorProfileRecord | null,
  };
}

async function approvePayoutRequest(token: string) {
  const supabase = createServiceClient();
  const lookup = await lookupPayoutRequest(token);

  if (lookup.state !== "ok") {
    return {
      state: "error" as const,
      title: lookup.title,
      message: lookup.message,
    };
  }

  const { payout } = lookup;
  const amount = Number(payout.amount);
  const connectStatus = await syncStripeConnectAccountStatus(payout.creator_id);

  if (!connectStatus.accountId || !connectStatus.payoutsEnabled) {
    return {
      state: "error" as const,
      title: "Stripe setup incomplete",
      message: "This creator's Stripe Connect account is not ready for payouts.",
    };
  }

  const summary = await getCreatorPayoutSummary(payout.creator_id);
  const reservedLedgerAvailable = summary.available + amount;

  if (amount > reservedLedgerAvailable + 0.001) {
    return {
      state: "error" as const,
      title: "Payout no longer available",
      message: "The creator no longer has enough approved earnings for this payout request.",
    };
  }

  if (amount > summary.stripeAvailable + 0.001) {
    return {
      state: "error" as const,
      title: "Stripe balance still clearing",
      message: `Stripe currently has ${formatCurrency(summary.stripeAvailable)} available for platform transfers. Try again after the balance clears.`,
    };
  }

  const now = new Date().toISOString();
  const { data: processingPayout, error: lockError } = await supabase
    .from("payouts")
    .update({
      status: "processing",
      approved_at: now,
      updated_at: now,
      review_token: null,
      failure_reason: null,
    })
    .eq("id", payout.id)
    .eq("status", "pending")
    .eq("review_token", token)
    .select("id, amount, creator_id")
    .maybeSingle();

  if (lockError || !processingPayout) {
    return {
      state: "done" as const,
      title: "Payout already reviewed",
      message: "This payout request was already updated by another review.",
    };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(amount * 100),
        currency: "usd",
        destination: connectStatus.accountId,
        metadata: {
          creator_id: payout.creator_id,
          payout_id: payout.id,
        },
      },
      {
        idempotencyKey: `creator-payout-${payout.id}`,
      }
    );

    await supabase
      .from("payouts")
      .update({
        status: "completed",
        stripe_id: null,
        stripe_transfer_id: transfer.id,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    return {
      state: "approved" as const,
      title: "Payout approved",
      message: `${formatCurrency(amount)} was transferred to the creator's Stripe Connect account.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send payout.";
    await supabase
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    return {
      state: "error" as const,
      title: "Stripe transfer failed",
      message,
    };
  }
}

async function rejectPayoutRequest(token: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data: payout, error } = await supabase
    .from("payouts")
    .update({
      status: "rejected",
      rejected_at: now,
      updated_at: now,
      review_token: null,
    })
    .eq("review_token", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !payout) {
    return {
      state: "done" as const,
      title: "Payout already reviewed",
      message: "This payout request was not pending or the review link has already been used.",
    };
  }

  return {
    state: "rejected" as const,
    title: "Payout rejected",
    message: "The payout request was rejected and the creator's earnings are no longer reserved by this request.",
  };
}

async function applyPayoutReview(token: string, action: ReviewAction) {
  if (action === "approve") return approvePayoutRequest(token);
  return rejectPayoutRequest(token);
}

async function confirmReview(formData: FormData) {
  "use server";
  const token = typeof formData.get("token") === "string" ? (formData.get("token") as string) : "";
  const rawAction = typeof formData.get("action") === "string" ? (formData.get("action") as string) : "";
  const action = normalizeAction(rawAction);

  if (!token || !action) {
    redirect("/creator-payouts/review?error=invalid");
  }

  const result = await applyPayoutReview(token, action!);
  redirect(`/creator-payouts/review?state=${encodeURIComponent(result.state)}&title=${encodeURIComponent(result.title)}&message=${encodeURIComponent(result.message)}`);
}

type ViewState = "approved" | "rejected" | "error" | "done";

function iconFor(state: ViewState) {
  if (state === "approved") return <CheckCircle2 className="w-8 h-8 text-brand-live" />;
  if (state === "rejected") return <XCircle className="w-8 h-8 text-red-400" />;
  if (state === "done") return <Clock3 className="w-8 h-8 text-brand-gold" />;
  return <XCircle className="w-8 h-8 text-red-400" />;
}

function ResultCard({ state, title, message }: { state: ViewState; title: string; message: string }) {
  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
          {iconFor(state)}
        </div>
        <h1 className="text-2xl font-serif font-normal text-brand-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">{message}</p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-brand-border bg-brand-elevated px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-primary/10 hover:text-brand-primary-light"
          >
            Back to Friendsly
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function CreatorPayoutReviewPage({
  searchParams,
}: {
  searchParams: {
    token?: string | string[];
    action?: string | string[];
    state?: string | string[];
    title?: string | string[];
    message?: string | string[];
    error?: string | string[];
  };
}) {
  const stateParam = typeof searchParams.state === "string" ? searchParams.state : Array.isArray(searchParams.state) ? searchParams.state[0] : undefined;
  if (stateParam) {
    const title = typeof searchParams.title === "string" ? searchParams.title : "Review complete";
    const message = typeof searchParams.message === "string" ? searchParams.message : "The payout request has been updated.";
    const state = (["approved", "rejected", "error", "done"] as const).includes(stateParam as ViewState)
      ? (stateParam as ViewState)
      : "done";

    return <ResultCard state={state} title={title} message={message} />;
  }

  const token = normalizeToken(searchParams.token);
  const action = normalizeAction(searchParams.action);

  if (!token || !action) {
    return (
      <ResultCard
        state="error"
        title="Review link invalid"
        message="This link is missing the information needed to review the payout request."
      />
    );
  }

  const lookup = await lookupPayoutRequest(token);
  if (lookup.state === "error") {
    return <ResultCard state="error" title={lookup.title} message={lookup.message} />;
  }

  const { payout, creator } = lookup;
  const isApprove = action === "approve";

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
          {isApprove ? <CheckCircle2 className="w-8 h-8 text-brand-live" /> : <XCircle className="w-8 h-8 text-red-400" />}
        </div>
        <h1 className="text-2xl font-serif font-normal text-brand-ink">
          {isApprove ? "Approve payout request?" : "Reject payout request?"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">
          {isApprove
            ? "Confirm that this creator payout should be transferred through Stripe."
            : "Confirm that this creator payout request should be rejected."}
        </p>
        <div className="mt-5 rounded-2xl border border-brand-border bg-brand-elevated px-4 py-4 text-left">
          <p className="text-xs text-brand-ink-subtle">Creator</p>
          <p className="mt-1 text-sm font-semibold text-brand-ink">{creator?.full_name ?? "Creator"}</p>
          <p className="text-sm text-brand-ink-subtle">{creator?.email ?? "(no email)"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-brand-ink-subtle">Amount</p>
              <p className="text-sm font-semibold text-brand-ink">{formatCurrency(Number(payout.amount))}</p>
            </div>
            <div>
              <p className="text-xs text-brand-ink-subtle">Requested</p>
              <p className="text-sm font-semibold text-brand-ink">
                {new Date(payout.requested_at ?? payout.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <form action={confirmReview} className="mt-6 flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="action" value={action} />
          <button
            type="submit"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              isApprove
                ? "bg-brand-live text-white hover:bg-brand-live/90"
                : "bg-red-500 text-white hover:bg-red-500/90"
            }`}
          >
            {isApprove ? "Approve and Transfer" : "Reject"}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-brand-border bg-brand-elevated px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-primary/10 hover:text-brand-primary-light"
          >
            Cancel
          </Link>
        </form>
      </div>
    </main>
  );
}
