export function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  const withProtocol = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

export function getAuthRedirectBaseUrl() {
  // Prefer the canonical site URL so password-reset and OAuth redirects
  // always point at the production domain (friendsly.app), not at per-
  // deployment *.vercel.app aliases which look phishy in emails and can
  // widen the Supabase Redirect URL allowlist surface.
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  const withProtocol = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}
