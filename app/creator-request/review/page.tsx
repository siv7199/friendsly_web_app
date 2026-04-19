import Link from "next/link";
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

  await fetch(`${functionsBaseUrl}/creator-signup-notify`, {
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

async function applyCreatorRequestReview(token: string, action: ReviewAction) {
  const supabase = createServiceClient();
  const { data: request, error } = await supabase
    .from("creator_signup_requests")
    .select("id, email, full_name, status, reviewed_at, review_token")
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
  const { error: updateError } = await supabase
    .from("creator_signup_requests")
    .update({ status: nextStatus, reviewed_at: new Date().toISOString() })
    .eq("id", request.id);

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

export default async function CreatorRequestReviewPage({
  searchParams,
}: {
  searchParams: { token?: string | string[]; action?: string | string[] };
}) {
  const token = normalizeToken(searchParams.token);
  const action = normalizeAction(searchParams.action);

  const result = !token || !action
    ? {
        state: "error" as const,
        title: "Review link invalid",
        message: "This link is missing the information needed to review the creator request.",
      }
    : await applyCreatorRequestReview(token, action);

  const icon = result.state === "approved"
    ? <CheckCircle2 className="w-8 h-8 text-brand-live" />
    : result.state === "rejected"
    ? <XCircle className="w-8 h-8 text-red-400" />
    : result.state === "pending-account"
    ? <Clock3 className="w-8 h-8 text-brand-gold" />
    : <XCircle className="w-8 h-8 text-red-400" />;

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated">
          {icon}
        </div>
        <h1 className="text-2xl font-black text-brand-ink">{result.title}</h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink-subtle">{result.message}</p>
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
