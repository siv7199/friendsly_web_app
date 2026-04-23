import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sanitizeSocialUrl } from "@/lib/social";
import { checkRateLimit, readJsonBody } from "@/lib/server/request-security";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-().\s]{7,20}$/;
const URL_REGEX = /^https?:\/\/\S+$/i;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

async function notifyCreatorRequest(details: {
  fullName: string;
  email: string;
  phone: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  notes: string;
  createdAt: string;
  reviewToken: string;
}) {
  const functionsBaseUrl = getFunctionsBaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!functionsBaseUrl || !serviceRoleKey) {
    return { attempted: false, delivered: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  const url = `${functionsBaseUrl}/creator_signup_notify`;
  console.log("creator-signup-request: Calling notification URL:", url);

  try {
    const response = await fetch(url, {
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
    console.warn("creator-signup-request: Notification fetch error or timeout", error);
    return { attempted: true, delivered: false };
  }
}

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "creator-signup-request", {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const fullName = normalizeText(body.fullName);
    const email = normalizeText(body.email).toLowerCase();
    const phone = normalizeText(body.phone);
    const instagramUrl = sanitizeSocialUrl(normalizeText(body.instagramUrl));
    const tiktokUrl = sanitizeSocialUrl(normalizeText(body.tiktokUrl));
    const xUrl = sanitizeSocialUrl(normalizeText(body.xUrl));
    const notes = normalizeText(body.notes);

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { error: "Full name, email, and phone number are required." },
        { status: 400 }
      );
    }

    if (fullName.length > 120 || notes.length > 2000) {
      return NextResponse.json({ error: "Please shorten your request details." }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
    }

    if (instagramUrl && !URL_REGEX.test(instagramUrl)) {
      return NextResponse.json(
        { error: "Instagram must be a full URL starting with http:// or https://." },
        { status: 400 }
      );
    }

    if (tiktokUrl && !URL_REGEX.test(tiktokUrl)) {
      return NextResponse.json(
        { error: "TikTok must be a full URL starting with http:// or https://." },
        { status: 400 }
      );
    }

    if (xUrl && !URL_REGEX.test(xUrl)) {
      return NextResponse.json(
        { error: "X must be a full URL starting with http:// or https://." },
        { status: 400 }
      );
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

    const { data: existing } = await serviceSupabase
      .from("creator_signup_requests")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "There is already a pending creator request for this email." },
        { status: 409 }
      );
    }

    const payload = {
      requested_by_user_id: requestedByUserId,
      full_name: fullName,
      email,
      phone,
      social_link: instagramUrl || tiktokUrl || xUrl || null,
      instagram_url: instagramUrl || null,
      tiktok_url: tiktokUrl || null,
      x_url: xUrl || null,
      notes: notes || null,
    };

    const { data: inserted, error } = await serviceSupabase
      .from("creator_signup_requests")
      .insert(payload)
      .select("created_at, review_token")
      .single();

    if (error) {
      console.error("creator-signup-request: Database insert failed", error);
      return NextResponse.json(
        {
          error: "Could not save creator request.",
          debug: process.env.NODE_ENV !== "production" ? error : undefined,
        },
        { status: 500 }
      );
    }

    // Trigger notification (background-ish with timeout)
    const emailResult = await notifyCreatorRequest({
      fullName,
      email,
      phone,
      instagramUrl,
      tiktokUrl,
      xUrl,
      notes,
      createdAt: inserted.created_at,
      reviewToken: inserted.review_token,
    });

    return NextResponse.json({
      ok: true,
      emailNotificationSent: emailResult.delivered,
      emailNotificationConfigured: emailResult.attempted,
    });
  } catch (err) {
    console.error("creator-signup-request: Unexpected error", err);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
