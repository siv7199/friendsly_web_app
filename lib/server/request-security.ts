import { NextResponse } from "next/server";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  key?: string | null;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_INTENT_REGEX = /^pi_[A-Za-z0-9_]+$/;
const PAYMENT_METHOD_REGEX = /^pm_[A-Za-z0-9_]+$/;

export async function readJsonBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwardedFor ||
    "unknown"
  );
}

export function checkRateLimit(request: Request, scope: string, options: RateLimitOptions) {
  const now = Date.now();
  const identity = options.key || getClientIp(request);
  const key = `${scope}:${identity}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  existing.count += 1;

  if (existing.count <= options.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export function stringField(body: Record<string, unknown>, key: string, maxLength = 500) {
  const value = body[key];
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function booleanField(body: Record<string, unknown>, key: string) {
  return body[key] === true;
}

export function numberField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

export function isPaymentIntentId(value: string) {
  return PAYMENT_INTENT_REGEX.test(value);
}

export function isPaymentMethodId(value: string) {
  return PAYMENT_METHOD_REGEX.test(value);
}

export function isIsoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

export function isSafeMoneyCents(value: number | null, maxCents = 100_000) {
  return value !== null && Number.isInteger(value) && value >= 50 && value <= maxCents;
}
