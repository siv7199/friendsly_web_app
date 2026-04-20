import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, readJsonBody, stringField } from "@/lib/server/request-security";

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "prelogin-status", {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const email = normalizeEmail(stringField(body, "email", 320));

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const [{ data: profile, error: profileError }, { data: requestRow, error: requestError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role")
        .eq("email", email)
        .maybeSingle(),
      supabase
        .from("creator_signup_requests")
        .select("status")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError || requestError) {
      return NextResponse.json({ error: "Could not check login eligibility." }, { status: 500 });
    }

    const hasApprovedRole = profile?.role === "fan" || profile?.role === "creator";
    const requestStatus = requestRow?.status ?? null;
    const blocked = !hasApprovedRole && (requestStatus === "pending" || requestStatus === "rejected");

    return NextResponse.json({
      blocked,
      requestStatus,
      hasApprovedRole,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
