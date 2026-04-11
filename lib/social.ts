const SOCIAL_HOSTS = {
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
} as const;

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function sanitizeSocialUrl(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isSocialUrlForPlatform(
  value: string,
  platform: keyof typeof SOCIAL_HOSTS
): boolean {
  const sanitized = sanitizeSocialUrl(value);
  if (!sanitized) return false;

  try {
    const hostname = new URL(sanitized).hostname.toLowerCase();
    return SOCIAL_HOSTS[platform].includes(hostname as never);
  } catch {
    return false;
  }
}

export function getSocialHandleLabel(value: string): string {
  const sanitized = sanitizeSocialUrl(value);
  if (!sanitized) return "";

  try {
    const url = new URL(sanitized);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return url.hostname.replace(/^www\./, "");
    const handle = parts[0].startsWith("@") ? parts[0] : `@${parts[0]}`;
    return handle;
  } catch {
    return "";
  }
}
