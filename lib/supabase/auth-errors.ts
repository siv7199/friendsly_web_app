"use client";

export function formatSupabaseAuthError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit reached") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "Too many emails sent. Please wait up to an hour before requesting another email.";
  }

  return message;
}
