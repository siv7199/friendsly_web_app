import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

type ReviewAction = "approve" | "reject";

function normalizeAction(value: string | string[] | undefined): ReviewAction | null {
  const action = Array.isArray(value) ? value[0] : value;
  return action === "approve" || action === "reject" ? action : null;
}

function normalizeToken(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

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

async function notifyCreatorDecision(email: string, decision: "approved" | "rejected") {
  const functionsBaseUrl = getFunctionsBaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!functionsBaseUrl || !serviceRoleKey) return;

  await fetch(`${functionsBaseUrl}/super-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "decision",
      email,
      decision,
      loginUrl: `${appBaseUrl.replace(/\/$/, "")}/`,
    }),
  }).catch(() => null);
}

type ReviewLookup =
  | {
      state: "ok";
      request: { id: string; email: string; full_name: string | null; status: string };
    }
  | { state: "error"; title: string; message: string };

async function lookupReviewRequest(token: string): Promise<ReviewLookup> {
  const supabase = createServiceClient();
  const { data: request, error } = await supabase
    .from("creator_signup_requests")
    .select("id, email, full_name, status")
    .eq("review_token", token)
    .maybeSingle();

  if (error || !request) {
    return {
      state: "error",
      title: "Review link invalid",
      message: "We could not find a matching creator request for this review link.",
    };
  }

  if (request.status !== "pending") {
    return {
      state: "error",
      title: "Request already reviewed",
      message: `This creator request was already marked as ${request.status}.`,
    };
  }

  return { state: "ok", request };
}

async function applyCreatorRequestReview(token: string, action: ReviewAction) {
  const supabase = createServiceClient();
  const { data: request, error } = await supabase
    .from("creator_signup_requests")
    .select("id, email, full_name, status")
    .eq("review_token", token)
    .maybeSingle();

  if (error || !request) {
    return {
      state: "error" as const,
      title: "Review link invalid",
      message: "We could not find a matching creator request for this review link.",
    };
  }

  if (request.status !== "pending") {
    return {
      state: "done" as const,
      title: "Request already reviewed",
      message: `This creator request was already marked as ${request.status}.`,
    };
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  // Rotate the review_token in the same UPDATE so a stale email link cannot be
  // replayed to poll the status or retry the action.
  const { error: updateError } = await supabase
    .from("creator_signup_requests")
    .update({ status: nextStatus, reviewed_at: new Date().toISOString(), review_token: null })
    .eq("id", request.id)
    .eq("status", "pending");

  if (updateError) {
    return {
      state: "error" as const,
      title: "Could not review request",
      message: "The request could not be updated. Please try again from Supabase.",
    };
  }

  if (action === "reject") {
    await notifyCreatorDecision(request.email, "rejected");
    return {
      state: "rejected" as const,
      title: "Creator request rejected",
      message: "The request has been marked as rejected.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", request.email)
    .maybeSingle();

  if (!profile) {
    return {
      state: "pending-account" as const,
      title: "Request approved",
      message: "The request is approved, but this email does not have a Friendsly account yet. Once they sign up, promote them to creator from Supabase.",
    };
  }

  await supabase.from("profiles").update({ role: "creator" }).eq("id", profile.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("creator_profiles") as any).upsert({ id: profile.id }, { onConflict: "id" });
  await supabase.auth.admin.updateUserById(profile.id, { user_metadata: { role: "creator" } });
  await notifyCreatorDecision(request.email, "approved");

  return {
    state: "approved" as const,
    title: "Creator approved",
    message: "The request has been approved and the existing Friendsly account was promoted to creator access.",
  };
}

// Server action — invoked only by an explicit form submission (POST), not by
// link-preview crawlers that follow the email's GET URL.
async function confirmReview(formData: FormData) {
  "use server";
  const token = typeof formData.get("token") === "string" ? (formData.get("token") as string) : "";
  const rawAction = typeof formData.get("action") === "string" ? (formData.get("action") as string) : "";
  const action = normalizeAction(rawAction);

  if (!token || !action) {
    redirect("/creator-request/review?error=invalid");
  }

  const result = await applyCreatorRequestReview(token, action!);
  redirect(`/creator-request/review?state=${encodeURIComponent(result.state)}&title=${encodeURIComponent(result.title)}&message=${encodeURIComponent(result.message)}`);
}

type ViewState = "approved" | "rejected" | "pending-account" | "error" | "done";

function iconFor(state: ViewState) {
  if (state === "approved") return <CheckCircle2 className="w-8 h-8 text-brand-live" />;
  if (state === "rejected") return <XCircle className="w-8 h-8 text-red-400" />;
  if (state === "pending-account") return <Clock3 className="w-8 h-8 text-brand-gold" />;
  return <XCircle className="w-8 h-8 text-red-400" />;
}

export default async function CreatorRequestReviewPage({
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
  // Post-action result screen (after the server action redirects here).
  const stateParam = typeof searchParams.state === "string" ? searchParams.state : Array.isArray(searchParams.state) ? searchParams.state[0] : undefined;
  if (stateParam) {
    const title = typeof searchParams.title === "string" ? searchParams.title : "Review complete";
    const message = typeof searchParams.message === "string" ? searchParams.message : "The creator request has been updated.";
    const state = (["approved", "rejected", "pending-account", "error", "done"] as const).includes(stateParam as ViewState)
      ? (stateParam as ViewState)
      : "done";

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

  // Confirmation screen (from the original email link). GET does NOT mutate.
  const token = normalizeToken(searchParams.token);
  const action = normalizeAction(searchParams.action);

  if (!token || !action) {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-serif font-normal text-brand-ink">Review link invalid</h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">
            This link is missing the information needed to review the creator request.
          </p>
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

  const lookup = await lookupReviewRequest(token);

  if (lookup.state === "error") {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-serif font-normal text-brand-ink">{lookup.title}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">{lookup.message}</p>
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

  const { request } = lookup;
  const isApprove = action === "approve";

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
          {isApprove ? <CheckCircle2 className="w-8 h-8 text-brand-live" /> : <XCircle className="w-8 h-8 text-red-400" />}
        </div>
        <h1 className="text-2xl font-serif font-normal text-brand-ink">
          {isApprove ? "Approve creator request?" : "Reject creator request?"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">
          {isApprove
            ? "Confirm that this applicant should be granted creator access."
            : "Confirm that this applicant should be rejected."}
        </p>
        <div className="mt-5 rounded-2xl border border-brand-border bg-brand-elevated px-4 py-4 text-left">
          <p className="text-xs text-brand-ink-subtle">Applicant</p>
          <p className="mt-1 text-sm font-semibold text-brand-ink">{request.full_name ?? "(no name)"}</p>
          <p className="text-sm text-brand-ink-subtle">{request.email}</p>
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
            {isApprove ? "Approve" : "Reject"}
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
