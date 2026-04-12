import crypto from "crypto";

const DEFAULT_ACCESS_TOKEN_BYTES = 32;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
}

export function hashAccessToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRawAccessToken() {
  return crypto.randomBytes(DEFAULT_ACCESS_TOKEN_BYTES).toString("hex");
}

export function buildAccessTokenRecord(expiresInHours = 48) {
  const rawToken = createRawAccessToken();
  const tokenHash = hashAccessToken(rawToken);
  const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000)).toISOString();

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}
