/**
 * lib/mock-auth.ts
 *
 * The "mock database" layer for authentication.
 * Handles all reading/writing to localStorage and the session cookie.
 *
 * WHY TWO LAYERS?
 * - Cookie  → readable by middleware.ts at the Edge (server-side redirect logic)
 * - localStorage → readable only in the browser (full profile data)
 *
 * This is exactly how Supabase works in production:
 *   Cookie   = Supabase session JWT  (middleware reads it)
 *   localStorage = Your own profile table (client reads it via supabase-js)
 *
 * When you're ready to switch: replace each function body below with
 * the matching Supabase call — all consumers stay the same.
 */

import type { Creator, CreatorProfile, MockProfile, UserRole } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────

/** All user profiles, stored as { [id]: MockProfile } */
export const STORAGE_KEY = "mock_profiles";
export const COOKIE_KEY  = "mock_session_role";

/**
 * Avatar background colours — picked randomly at signup.
 * Uses Tailwind classes that exist in our safelist (brand palette).
 */
export const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-purple-600",
  "bg-indigo-600",
  "bg-sky-600",
  "bg-pink-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-fuchsia-600",
] as const;

/**
 * Creator categories — match the ones already used in MOCK_CREATORS
 * so the discover grid looks consistent during development.
 */
export const CREATOR_CATEGORIES = [
  "Fitness & Wellness",
  "Business & Startups",
  "Content Creation",
  "Finance & Investing",
  "Beauty & Skincare",
  "Tech & Career",
  "Music & Arts",
  "Gaming & Esports",
] as const;

// ── SSR Guard ─────────────────────────────────────────────────────────

/** Returns true only when running in the browser (not on the Next.js server) */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ── localStorage helpers ──────────────────────────────────────────────

/**
 * Read all stored profiles as a map of { [id]: MockProfile }.
 * Internal helper — external code uses getProfile() / getProfileByEmail().
 */
function getAllProfiles(): Record<string, MockProfile> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Handle old single-profile format (migration): wrap it in a map
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.id) {
      return { [parsed.id]: parsed as MockProfile };
    }
    return parsed as Record<string, MockProfile>;
  } catch {
    return {};
  }
}

/**
 * Read a profile by user ID.
 * Returns null on the server or when no profile with that ID exists.
 *
 * → Future Supabase: replace with
 *   supabase.from('profiles').select().eq('id', userId).single()
 */
export function getProfile(userId?: string): MockProfile | null {
  if (!isBrowser()) return null;
  if (userId) return getAllProfiles()[userId] ?? null;
  // No userId given — fall back to reading the active session cookie
  const session = readCookieSession();
  if (!session) return null;
  return getAllProfiles()[session.userId] ?? null;
}

/**
 * Find a profile by email address (used during login to look up returning users).
 */
export function getProfileByEmail(email: string): MockProfile | null {
  if (!isBrowser()) return null;
  const all = getAllProfiles();
  return Object.values(all).find((p) => p.email === email) ?? null;
}

/**
 * Write a profile to localStorage (upserted by ID).
 * Multiple accounts can be stored simultaneously.
 *
 * → Future Supabase: replace with
 *   supabase.from('profiles').upsert(profile)
 */
export function saveProfile(profile: MockProfile): void {
  if (!isBrowser()) return;
  const all = getAllProfiles();
  all[profile.id] = profile;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Remove a specific profile from storage (used on account deletion).
 * Pass no argument to clear everything (nuclear option).
 *
 * → Future Supabase: no equivalent needed (session expiry handles it)
 */
export function clearProfile(userId?: string): void {
  if (!isBrowser()) return;
  if (!userId) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const all = getAllProfiles();
  delete all[userId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Cookie helpers ────────────────────────────────────────────────────

/**
 * Set the session cookie that middleware.ts reads.
 * Format: "fan|<uuid>"  |  "creator|<uuid>"  |  "pending|<uuid>"
 *
 * 7-day expiry, path=/ so middleware sees it on all routes.
 *
 * → Future Supabase: supabase.auth.signIn() sets this automatically via
 *   the @supabase/ssr package — you won't call this manually.
 */
export function setCookieSession(role: UserRole | "pending", userId: string): void {
  if (!isBrowser()) return;
  const value = `${role}|${userId}`;
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Expire the session cookie (used on logout).
 *
 * → Future Supabase: supabase.auth.signOut() handles this.
 */
export function clearCookieSession(): void {
  if (!isBrowser()) return;
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`;
}

/**
 * Read the raw cookie value from document.cookie.
 * Returns { role, userId } or null if not present.
 *
 * Used by useAuth.ts to hydrate state on page load.
 */
export function readCookieSession(): { role: string; userId: string } | null {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_KEY}=`));
  if (!match) return null;
  const value = match.split("=")[1];
  const [role, userId] = value.split("|");
  if (!role || !userId) return null;
  return { role, userId };
}

// ── Profile creation helpers ──────────────────────────────────────────

/**
 * Derive initials from a full name.
 * "Jordan Kim"  → "JK"
 * "Luna"        → "LU"
 * "A B C"       → "AB"  (first two words only)
 */
export function deriveInitials(full_name: string): string {
  const parts = full_name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Derive a username from an email address.
 * "jordan.kim@gmail.com" → "jordankim"
 */
export function deriveUsername(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

/**
 * Pick a random avatar color from the palette.
 */
export function pickAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/**
 * Create a brand-new profile object from signup data.
 * Role is null ("pending") — onboarding sets it.
 *
 * Cast is necessary here because BaseProfile with role: null isn't
 * a full MockProfile yet. We store it anyway and complete it in onboarding.
 */
export function createPendingProfile(
  email: string,
  full_name: string
): MockProfile {
  const id = crypto.randomUUID();
  return {
    id,
    email,
    full_name,
    username: deriveUsername(email),
    role: null,
    avatar_initials: deriveInitials(full_name),
    avatar_color: pickAvatarColor(),
    created_at: new Date().toISOString(),
  } as unknown as MockProfile; // role: null before onboarding completes
}

// ── Creator Registry ──────────────────────────────────────────────────

const REGISTERED_CREATORS_KEY = "registered_creators";

/**
 * Maps a CreatorProfile (auth shape) → Creator (display card shape).
 * Fills in display-only fields with sensible defaults for new creators.
 */
function creatorProfileToCard(profile: CreatorProfile): Creator {
  // Check if this creator has active packages to show correct availability text
  const hasPackages = (profile.hourly_rate ?? 0) > 0;
  return {
    id: profile.id,
    name: profile.full_name,
    username: `@${profile.username}`,
    bio: profile.bio || "New creator — check back soon.",
    category: profile.category,
    tags: [profile.category.split(" & ")[0]],
    followers: "New",
    rating: 0,
    reviewCount: 0,
    avatarInitials: profile.avatar_initials,
    avatarColor: profile.avatar_color,
    avatarUrl: profile.avatar_url,
    isLive: profile.is_live,
    queueCount: 0,
    callPrice: profile.hourly_rate ?? 0,
    callDuration: 15,
    nextAvailable: hasPackages ? "Available this week" : "No packages yet",
    totalCalls: 0,
    responseTime: "New creator",
  };
}

/**
 * Persist a completed CreatorProfile to the "registered_creators" registry
 * so fans can discover them on /discover.
 *
 * Stores an array of CreatorProfile objects keyed by profile.id,
 * so re-submitting onboarding simply overwrites the previous entry.
 *
 * → Future Supabase: replace with supabase.from('profiles').upsert(profile)
 */
export function saveRegisteredCreator(profile: CreatorProfile): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(REGISTERED_CREATORS_KEY);
    const existing: CreatorProfile[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((p) => p.id !== profile.id);
    localStorage.setItem(
      REGISTERED_CREATORS_KEY,
      JSON.stringify([...filtered, profile])
    );
  } catch {
    // silently ignore storage errors
  }
}

/**
 * Read all registered creators and convert them to Creator display cards.
 * Called by the fan's /discover page to show real creators alongside mock data.
 *
 * → Future Supabase: replace with
 *   supabase.from('profiles').select().eq('role', 'creator')
 */
export function getRegisteredCreators(): Creator[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(REGISTERED_CREATORS_KEY);
    if (!raw) return [];
    const profiles: CreatorProfile[] = JSON.parse(raw);
    return profiles.map(creatorProfileToCard);
  } catch {
    return [];
  }
}

// ── Package Registry ──────────────────────────────────────────────────

const PACKAGES_KEY = "creator_packages";

/**
 * Persist a creator's call packages to localStorage.
 * Also updates their callPrice in registered_creators to reflect
 * the cheapest active package (so the fan Discover page stays in sync).
 *
 * → Future Supabase: replace with supabase.from('packages').upsert(packages)
 */
export function saveCreatorPackages(creatorId: string, packages: import("@/types").CallPackage[]): void {
  if (!isBrowser()) return;
  try {
    const all: Record<string, import("@/types").CallPackage[]> = JSON.parse(
      localStorage.getItem(PACKAGES_KEY) || "{}"
    );
    all[creatorId] = packages;
    localStorage.setItem(PACKAGES_KEY, JSON.stringify(all));

    // Keep registered_creators callPrice in sync
    const activePrices = packages.filter((p) => p.isActive).map((p) => p.price);
    const minPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0;
    const raw = localStorage.getItem(REGISTERED_CREATORS_KEY);
    if (raw) {
      const profiles: CreatorProfile[] = JSON.parse(raw);
      const updated = profiles.map((p) =>
        p.id === creatorId ? { ...p, hourly_rate: minPrice } : p
      );
      localStorage.setItem(REGISTERED_CREATORS_KEY, JSON.stringify(updated));
    }
  } catch {
    // silently ignore
  }
}

/**
 * Load a creator's call packages from localStorage.
 * Returns empty array if none saved yet.
 */
export function getCreatorPackages(creatorId: string): import("@/types").CallPackage[] {
  if (!isBrowser()) return [];
  try {
    const all: Record<string, import("@/types").CallPackage[]> = JSON.parse(
      localStorage.getItem(PACKAGES_KEY) || "{}"
    );
    return all[creatorId] ?? [];
  } catch {
    return [];
  }
}
