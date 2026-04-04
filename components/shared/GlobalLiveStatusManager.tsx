"use client";

/**
 * GlobalLiveStatusManager (shared / root layout)
 *
 * Previously reset is_live on pathname changes and cleaned up mock data.
 * Both effects were removed:
 *  - The pathname reset fired whenever the creator opened ANY non-/live page
 *    (e.g. dashboard in a second tab), which immediately killed the live badge.
 *  - The mock-ID cleanup queried creator_profiles with non-UUID IDs → 400.
 *
 * Cleanup is now handled exclusively by components/creator/GlobalLiveStatusManager
 * which lives in the creator layout and runs its cleanup only when the creator
 * actually leaves the creator section (correct unmount semantics).
 */
export function GlobalLiveStatusManager() {
  return null;
}
