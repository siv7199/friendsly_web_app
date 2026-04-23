"use client";

export function formatSupabaseAuthError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit reached") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "We hit the email sending limit for signup confirmations. Please wait a bit before trying again, or raise the Auth email rate limit in Supabase.";
  }

  return message;
}
