export const LIVE_STAGE_MIN_SECONDS = 30;
export const LIVE_STAGE_MAX_MINUTES = 5;
export const LIVE_STAGE_SECONDS = LIVE_STAGE_MAX_MINUTES * 60;
export const LIVE_MIN_JOIN_FEE = 0;
export const LIVE_PREAUTH_MINUTES = 5;
export const LIVE_PROCESSING_FEE_RATE = 0.025;

export function normalizeLiveJoinFee(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(parsed.toFixed(2));
}

export function isValidLiveJoinFee(value: number | string | null | undefined) {
  return normalizeLiveJoinFee(value) > LIVE_MIN_JOIN_FEE;
}

export function getLiveJoinFeeCents(value: number | string | null | undefined) {
  return Math.round(normalizeLiveJoinFee(value) * 100);
}

export function getLivePreauthAmount(value: number | string | null | undefined) {
  return normalizeLiveJoinFee(value) * LIVE_PREAUTH_MINUTES;
}

export function getLivePreauthAmountCents(value: number | string | null | undefined) {
  return Math.round(getLivePreauthAmount(value) * 100);
}

export function getLiveFanChargeAmount(value: number | string | null | undefined) {
  return Math.round((normalizeLiveJoinFee(value) * (1 + LIVE_PROCESSING_FEE_RATE)) * 100) / 100;
}

export function getLiveFanChargeAmountCents(value: number | string | null | undefined) {
  return Math.round(getLiveFanChargeAmount(value) * 100);
}

export function getLivePreauthFanChargeAmount(value: number | string | null | undefined) {
  return Math.round((getLivePreauthAmount(value) * (1 + LIVE_PROCESSING_FEE_RATE)) * 100) / 100;
}

export function getLivePreauthFanChargeAmountCents(value: number | string | null | undefined) {
  return Math.round(getLivePreauthFanChargeAmount(value) * 100);
}

export function getLiveChargeAmount(params: {
  ratePerMinute: number | string | null | undefined;
  durationSeconds: number;
}) {
  const rate = normalizeLiveJoinFee(params.ratePerMinute);
  const seconds = Math.max(0, params.durationSeconds);
  return Math.round(((rate * seconds) / 60) * 100) / 100;
}

export function getLiveChargeAmountCents(params: {
  ratePerMinute: number | string | null | undefined;
  durationSeconds: number;
}) {
  return Math.round(getLiveChargeAmount(params) * 100);
}

export function getLiveFanChargedAmount(params: {
  ratePerMinute: number | string | null | undefined;
  durationSeconds: number;
}) {
  return Math.round((getLiveChargeAmount(params) * (1 + LIVE_PROCESSING_FEE_RATE)) * 100) / 100;
}

export function getLiveFanChargedAmountCents(params: {
  ratePerMinute: number | string | null | undefined;
  durationSeconds: number;
}) {
  return Math.round(getLiveFanChargedAmount(params) * 100);
}

export function getLiveCreatorRevenueBaseFromChargedAmount(value: number | string | null | undefined) {
  const chargedCents = Math.round(Number(value ?? 0) * 100);
  if (!Number.isFinite(chargedCents) || chargedCents <= 0) return 0;
  return Math.round(chargedCents / (1 + LIVE_PROCESSING_FEE_RATE)) / 100;
}

export function getLiveStageElapsedSeconds(startedAt?: string | null, nowMs = Date.now()) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
}

export function getLiveStageRemainingSeconds(startedAt?: string | null, nowMs = Date.now()) {
  return Math.max(0, LIVE_STAGE_SECONDS - getLiveStageElapsedSeconds(startedAt, nowMs));
}
