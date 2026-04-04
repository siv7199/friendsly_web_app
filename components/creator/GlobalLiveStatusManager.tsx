"use client";

/**
 * GlobalLiveStatusManager
 *
 * This component intentionally does nothing.
 *
 * We previously cleaned up creator live state on layout unmount, but that was
 * too aggressive and could incorrectly mark a creator offline during ordinary
 * navigation/re-renders. Live sessions should now be ended explicitly from the
 * live console, not from layout teardown side effects.
 */
export function GlobalLiveStatusManager() {
  return null;
}
