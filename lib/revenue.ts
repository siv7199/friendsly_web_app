export const CREATOR_REVENUE_SHARE = 0.7;
export const PLATFORM_REVENUE_SHARE = 0.3;

export function getCreatorRevenueShare(amount: number) {
  return amount * CREATOR_REVENUE_SHARE;
}

export function getPlatformRevenueShare(amount: number) {
  return amount * PLATFORM_REVENUE_SHARE;
}
