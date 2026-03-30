/**
 * types/index.ts
 *
 * Central type definitions for the Friendsly app.
 * TypeScript interfaces act like "blueprints" — they describe the shape
 * of the data objects we pass around. This prevents bugs and gives
 * autocomplete in your editor.
 */

// ── Creator / Influencer ──────────────────────────────────────────────
export interface Creator {
  id: string;
  name: string;
  username: string;
  bio: string;
  category: string;
  tags: string[];
  followers: string;       // Formatted string e.g. "48.2K"
  rating: number;          // 0–5
  reviewCount: number;
  avatarInitials: string;  // Fallback if no image — "LV", "MJ"
  avatarColor: string;     // Tailwind bg class for avatar
  avatarUrl?: string;      // Profile photo URL (base64 or remote)
  isLive: boolean;
  queueCount: number;      // People currently in queue
  callPrice: number;       // USD per session
  callDuration: number;    // Minutes per session
  nextAvailable: string;   // Human-readable — "Today, 3:00 PM"
  totalCalls: number;
  responseTime: string;    // e.g. "~2 min"
}

// ── Booking ───────────────────────────────────────────────────────────
export type BookingStatus = "upcoming" | "completed" | "cancelled" | "live";

export interface Booking {
  id: string;
  creatorId: string;
  creatorName: string;
  fanName: string;
  fanUsername: string;
  date: string;            // ISO date string
  time: string;            // "3:00 PM"
  duration: number;        // Minutes
  price: number;           // USD
  status: BookingStatus;
  topic?: string;          // Optional topic the fan submitted
  rating?: number;         // Post-call rating from fan
}

// ── Queue Entry (Waiting Room) ────────────────────────────────────────
export interface QueueEntry {
  id: string;
  fanName: string;
  fanUsername: string;
  avatarInitials: string;
  avatarColor: string;
  position: number;
  waitTime: string;        // "~8 min"
  topic?: string;
  joinedAt: string;        // ISO timestamp
}

// ── Chat Message (Waiting Room) ───────────────────────────────────────
export interface ChatMessage {
  id: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  message: string;
  timestamp: string;
  isCreator?: boolean;
}

// ── Creator Stats (Dashboard) ─────────────────────────────────────────
export interface CreatorStats {
  totalEarnings: number;
  callsThisMonth: number;
  avgRating: number;
  upcomingBookings: number;
  totalFans: number;
  conversionRate: number;  // % of profile views that booked
}

// ── Call Package (Creator Management) ────────────────────────────────
export interface CallPackage {
  id: string;
  name: string;            // "Quick Chat", "Deep Dive"
  duration: number;        // Minutes
  price: number;           // USD
  description: string;
  isActive: boolean;
  bookingsCount: number;
}

// ── Auth / Profile (Mock Auth System) ────────────────────────────────
export type UserRole = "fan" | "creator";

/**
 * BaseProfile — fields every user has regardless of role.
 * Stored in localStorage under key "mock_profiles".
 * The role field drives which sidebar/routes the user sees.
 */
export interface BaseProfile {
  id: string;              // crypto.randomUUID() on signup
  email: string;
  full_name: string;
  username: string;        // Derived from email prefix on signup, editable in settings
  role: UserRole | null;   // null = "pending" (signed up, hasn't picked role yet)
  avatar_initials: string; // "Jordan Kim" → "JK" — computed at signup
  avatar_color: string;    // Tailwind bg class, randomly assigned at signup
  avatar_url?: string;     // Base64 data URL of profile photo (optional)
  created_at: string;      // ISO timestamp
}

/** FanProfile — extends BaseProfile with fan-specific fields (minimal for now) */
export interface FanProfile extends BaseProfile {
  role: "fan";
}

/** CreatorProfile — extends BaseProfile with creator monetization fields */
export interface CreatorProfile extends BaseProfile {
  role: "creator";
  bio: string;
  hourly_rate: number;     // USD — used as callPrice in the mock Creator cards
  category: string;        // e.g. "Fitness & Wellness"
  is_live: boolean;
}

/** PendingProfile — signed up but hasn't picked a role yet (mid-onboarding) */
export interface PendingProfile extends BaseProfile {
  role: null;
}

/** Discriminated union — TypeScript narrows the type based on .role */
export type MockProfile = FanProfile | CreatorProfile | PendingProfile;

/** Type guard — use this to access creator-only fields safely */
export function isCreatorProfile(p: BaseProfile): p is CreatorProfile {
  return p.role === "creator";
}

export function isFanProfile(p: BaseProfile): p is FanProfile {
  return p.role === "fan";
}
