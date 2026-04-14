export const LIVE_STAGE_SECONDS = 30;
export const LIVE_MIN_JOIN_FEE = 10;

export function normalizeLiveJoinFee(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(parsed.toFixed(2));
}

export function isValidLiveJoinFee(value: number | string | null | undefined) {
  return normalizeLiveJoinFee(value) >= LIVE_MIN_JOIN_FEE;
}

export function getLiveJoinFeeCents(value: number | string | null | undefined) {
  return Math.round(normalizeLiveJoinFee(value) * 100);
}
