import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, readJsonBody } from "@/lib/server/request-security";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

async function notifySupportRequest(details: {
  fullName: string;
  email: string;
  subject: string;
  description: string;
  createdAt: string;
}) {
  const functionsBaseUrl = getFunctionsBaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!functionsBaseUrl || !serviceRoleKey) {
    return { attempted: false, delivered: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${functionsBaseUrl}/support-notify`, {
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
    };
  } catch (error) {
    console.warn("support-request: Notification fetch error or timeout", error);
    return { attempted: true, delivered: false };
  }
}

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "support-request", {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const fullName = normalizeText(body.fullName, 120);
    const email = normalizeText(body.email, 320).toLowerCase();
    const subject = normalizeText(body.subject, 160);
    const description = normalizeText(body.description, 4000);

    if (!fullName || !email || !subject || !description) {
      return NextResponse.json(
        { error: "Name, email, subject, and description are required." },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    let requestedByUserId: string | null = null;
    if (user?.id) {
      const { data: existingProfile } = await serviceSupabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      requestedByUserId = existingProfile?.id ?? null;
    }

    const { data: inserted, error } = await serviceSupabase
      .from("support_requests")
      .insert({
        requested_by_user_id: requestedByUserId,
        full_name: fullName,
        email,
        subject,
        description,
      })
      .select("created_at")
      .single();

    if (error) {
      console.error("support-request: Database insert failed", error);
      return NextResponse.json({ error: "Could not send support request." }, { status: 500 });
    }

    const emailResult = await notifySupportRequest({
      fullName,
      email,
      subject,
      description,
      createdAt: inserted.created_at,
    });

    return NextResponse.json({
      ok: true,
      emailNotificationSent: emailResult.delivered,
      emailNotificationConfigured: emailResult.attempted,
    });
  } catch (error) {
    console.error("support-request: Unexpected error", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
