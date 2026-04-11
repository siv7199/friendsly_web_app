# Friendsly — CLAUDE.md

## Project Overview
Friendsly is a monetization platform for micro-influencers. Fans either book dedicated 1-on-1 video calls or join a creator's live queue and pay per minute.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with a custom brand palette
- **Icons**: Lucide React
- **UI Components**: Custom shadcn-style components in `components/ui/`
- **Auth + DB**: Supabase (Auth + PostgreSQL)
- **Payments**: Stripe (real PaymentIntents + Elements — test mode active)
- **Video**: Daily.co (integrated for bookings + live queue)
- **Language**: TypeScript (strict mode)

## Core Business Model

### Live Queue (pay-per-minute)
- Creator goes public live → fans can join the queue for free, no booking needed
- Billing is **per second** — 30 seconds of talk = 30 seconds of charges
- Rate set by creator in `/management` as `live_rate_per_minute`
- Fan pre-authorizes a card hold (10 min × rate) when joining the queue
- Call ends when creator skips them (admits next person); actual charge captured at that point
- **Live badge** shown publicly on Discover and profile page
- Creator shows as live only for their **public** live queue — NOT during dedicated bookings

### Booking (fixed rate, pre-paid)
- Fan picks a package (e.g. 15 min / $25), selects a date/time from creator's calendar
- Full payment collected upfront via Stripe before the call
- Private dedicated session — no queue, fan joins directly at the scheduled time
- Creator does NOT show a public LIVE badge during a dedicated booking

## Folder Structure
```
app/
  (fan)/
    discover/         — Grid of creator cards
    profile/[id]/     — Creator profile with calendar, live rate, packages, reviews
    waiting-room/[id]/— Live queue + chat
  (creator)/
    dashboard/        — Stats + recent bookings
    management/       — Packages CRUD + live rate setting
    calendar/         — Upcoming/completed bookings
    live/             — Go Live console with queue management
  api/
    create-payment-intent/   — Stripe PaymentIntent (bookings)
    create-live-preauth/     — Stripe manual-capture PaymentIntent (live queue)

components/
  ui/         — Button, Badge, Card, Avatar, Dialog, Input
  fan/        — InfluencerCard, BookingModal, LiveJoinModal, WaitingRoom
  creator/    — StatsCard, BookingList, LiveConsole
  shared/     — FanSidebar, CreatorSidebar, BottomNav

lib/
  supabase/
    client.ts   — createClient() for browser components
    server.ts   — createClient() + createServiceClient() for server/API routes
  hooks/
    useAuth.ts  — Supabase Auth hook (login, signup, logout, updateProfile, setRole)
  context/
    AuthContext.tsx  — React Context distributing useAuth
  utils.ts          — cn(), formatCurrency(), formatDate(), statusColor(), timeAgo()
  mock-auth.ts      — Legacy helpers (deriveInitials, pickAvatarColor, etc.) — kept for compat

types/
  index.ts    — Creator, Booking, CallPackage, MockProfile, CreatorProfile, etc.

supabase/
  migrations/
    001_initial.sql  — Full schema (run once against the Supabase project)
```

## Supabase Project
- **URL**: `https://satowoyltkxkgwlfhdhd.supabase.co`
- **Keys**: stored in `.env.local` — never commit
- **Migration**: `supabase/migrations/001_initial.sql` — run via CLI or dashboard

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Public user data; one row per auth.users entry (auto-created by trigger) |
| `creator_profiles` | Creator-specific fields (bio, category, live_rate_per_minute, is_live) |
| `call_packages` | Creator's booking offerings (name, duration, price, is_active) |
| `creator_availability` | Weekly recurring availability slots (day_of_week, start_time, end_time) |
| `bookings` | Pre-paid dedicated sessions (fan + creator + package + scheduled_at) |
| `live_sessions` | Public live queue events (rate_per_minute, is_active) |
| `live_queue_entries` | Fan queue entries with pre-auth + actual charge fields |
| `reviews` | Post-call ratings from fans |
| `creator_signup_requests` | Pending/approved/rejected creator applications with review token + admin workflow |

## Color Palette (brand.*)
```
bg       #080614  — Deepest background
surface  #100D22  — Cards, sidebars
elevated #1A1535  — Modals, hover states
border   #2A2350  — Dividers

primary         #7C3AED  — Violet (brand purple)
primary-hover   #6D28D9
primary-light   #A78BFA  — Used for text on dark

gold            #F59E0B  — Amber (CTA, premium)
gold-light      #FCD34D

live            #22C55E  — Green (live indicator)
info            #38BDF8  — Sky blue (info states)
```

## Key Conventions
1. **`cn()` for all classNames** — Import from `@/lib/utils`, never concatenate strings manually.
2. **Types in `types/index.ts`** — All shared interfaces defined centrally.
3. **`"use client"` directive** — Required on any file using `useState`, `useEffect`, `usePathname`, or browser events.
4. **Route Groups `(fan)` / `(creator)`** — Invisible in URL, used for layout organization.
5. **Absolute imports via `@/`** — `import { Button } from "@/components/ui/button"` — never relative.
6. **Supabase client** — Use `createClient()` from `@/lib/supabase/client` in browser components; from `@/lib/supabase/server` in API routes and Server Components.

## Auth System (Supabase)

### Entry Point
`/` — Login + Create Account (two tabs). Authenticated users auto-redirect to their home.

### Auth Routes
```
/                          — Login + Create Account
/onboarding/role           — Pick Fan or Creator (post-signup)
/onboarding/creator-setup  — 3-step creator profile form
/onboarding/fan-setup      — Username form
/settings                  — Account + Billing tabs
```

### Profile Shape
```typescript
// profiles table (all users)
{
  id: uuid               // = auth.users.id
  email: string
  full_name: string
  username: string       // unique, derived from email
  role: "fan" | "creator" | null
  avatar_url?: string
  avatar_initials: string
  avatar_color: string   // Tailwind bg class
  created_at: timestamptz
}

// creator_profiles (creators only)
{
  id: uuid               // FK → profiles.id
  bio: string
  category: string
  tags: string[]
  live_rate_per_minute?: decimal  // $/min for public live sessions
  is_live: boolean
  followers_count: integer
  total_calls: integer
  avg_rating: decimal
  review_count: integer
}
```

### Role in JWT
Role is stored in `auth.users.user_metadata.role` so middleware can read it from the JWT without a DB call.
Set via `supabase.auth.updateUser({ data: { role } })` when the user picks their role in onboarding.

### Middleware
`middleware.ts` uses `@supabase/ssr` to refresh session cookies and reads `session.user.user_metadata.role` for redirect logic. No DB call.

### Critical Auth Rules (learned the hard way)

1. **`lib/supabase/client.ts` MUST use `createBrowserClient` from `@supabase/ssr` as a singleton.**
   - Singleton prevents multiple GoTrue instances that cause hanging requests
   - `@supabase/ssr` (not plain `@supabase/supabase-js`) is required — it stores sessions in cookies so the middleware can read them. Plain supabase-js uses localStorage and breaks middleware entirely.

2. **Never block auth/navigation on DB calls (`/rest/v1/` queries).**
   - Supabase DB REST calls can hang indefinitely in this project while auth calls work fine
   - `useAuth.ts` sets state from JWT immediately; `fetchProfile()` runs in background
   - `login`/`signup` do NOT call `fetchProfile` — they rely on `onAuthStateChange`

3. **`setRole()` must be `await`ed before `router.push()` in `role/page.tsx`.**
   - `setRole` calls `supabase.auth.updateUser({ data: { role } })` to update the JWT
   - Navigating before this completes means middleware sees no role → redirect loop

4. **DB trigger username uniqueness:** The `handle_new_user()` trigger derives username from email prefix. The `profiles.username` column is UNIQUE. If two emails share a prefix, the trigger fails with "Database error saving new user". The trigger was updated to append an incrementing counter when a username conflict exists.

5. **Email confirmation:** Disabled in Supabase (Authentication → Providers → Email → Confirm email OFF) for dev/testing. Re-enable for production.

6. **Sign out:** `logout()` must be `await`ed in sidebars, then `router.push("/")` — NOT `/login`.

### Key Files
```
middleware.ts                  ← Session refresh + route protection
lib/supabase/client.ts         ← Browser Supabase client (singleton createBrowserClient)
lib/supabase/server.ts         ← Server Supabase client + service client
lib/hooks/useAuth.ts           ← Auth state (login/signup/logout/updateProfile/setRole)
lib/context/AuthContext.tsx    ← React Context distribution layer
```

## Running the Project
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Stripe Payments

### Booking Flow (pre-pay)
1. Fan picks package + date/time → `POST /api/create-payment-intent`
2. Server creates PaymentIntent, returns `client_secret`
3. Fan pays → booking is confirmed

### Live Queue Flow (pre-auth)
1. Fan clicks "Join Queue" → `POST /api/create-live-preauth`
2. Server creates PaymentIntent with `capture_method: "manual"` — card is held, not charged
3. Pre-auth amount = 10 min × rate (e.g. $1.50/min → $15 hold)
4. When creator skips fan, server captures actual amount (seconds used × rate/60)
5. Remainder of hold is released automatically

### Test cards
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declines
- Any future expiry + any 3-digit CVC

### Key files
- `app/api/create-payment-intent/route.ts` — booking payments
- `app/api/create-live-preauth/route.ts` — live queue pre-authorization
- `components/fan/BookingModal.tsx` — booking payment UI
- `components/fan/LiveJoinModal.tsx` — live queue join + pre-auth UI

## Live Indicator Logic
- **Public live** (`is_live = true` in `creator_profiles`) → pulsing LIVE badge visible to everyone on Discover and profile page
- **Dedicated booking in progress** → creator does NOT appear live publicly; only the booked fan can join at that time
- Creator sets `is_live` when they click "Start Live Session" in `/live`

## Adding a New Creator Route
1. Create `app/(creator)/your-page/page.tsx`
2. Gets CreatorSidebar automatically from `app/(creator)/layout.tsx`
3. Add nav entry in `components/shared/CreatorSidebar.tsx` (NAV_ITEMS array)
4. Add matching entry in `components/shared/BottomNav.tsx` (CREATOR_ITEMS array)

## What Needs `"use client"`
- Any file using `useState`, `useEffect`, `useRef`
- Any file using `usePathname()` or `useRouter()`
- Components with event handlers (`onClick`, `onChange`, etc.)

Server Components (no directive needed): layout files, static pages without interactivity.

## Recent Features (Session Updates)
- **Pricing Label Standardization**: All pricing across the platform is now standardized to "Starts at $X per session".
- **Avatar Photo Uploads**: Added Camera UI image uploads to both Fan and Creator onboarding flows (Identity setup), replacing static color initials where a photo is chosen.
- **Review System**: Built out the creator profile to include a live review feed (fetched from Supabase) and a functional fan review submission form.
- **Calendar Navigation**: Redesigned the availability calendar and standard booking modal to feature full weekly pagination (Prev / Next buttons up to 3 weeks out) for better book-in-advance discoverability.
- **Database Booking Persistence**: Integrated with Supabase `bookings` table to actually capture Stripe successful payments securely. Replaced standard 5% fee displaying on the UI with a fixed 2.5% fan platform fee.
- **Creator Earnings & Payout Logic**: Integrated the creator Dashboard and Settings with Supabase `payouts`. Computes exactly an 85% creator cut of all bookings on stripe. Features a live "Withdraw" button that tracks withdrawal transactions dynamically.

## Current Platform Reality
- Daily.co is already integrated for both booking rooms and public live queue rooms.
- Live queue billing uses Stripe manual-capture PaymentIntents. Fans are pre-authorized for a max hold, then only the actual used amount is captured when the live queue entry completes.
- Stripe list views can still visually emphasize the original authorization amount, so PaymentIntent details are the source of truth for the real captured amount.
- Public live status should be treated as an active `live_sessions` row with a recent heartbeat, not just a `creator_profiles.is_live` boolean.
- Booking joinability opens 5 minutes early.
- Creator availability is Supabase-backed, can be package-specific, is timezone-aware, and supports `15`, `30`, or `60` minute booking start increments.
- Creators can announce a future live time using `scheduled_live_at` and `scheduled_live_timezone`, and fans see that as a countdown.
- The app currently tracks creator earnings, pending payouts, and withdrawal requests in Supabase, but full Stripe Connect onboarding and true production money movement to creator bank accounts are not fully wired yet.

## Recent Operational Notes
- Creator onboarding now has a request-first approval flow. Applicants set their password up front, their request is saved in `creator_signup_requests`, and admins approve from an email link backed by `review_token`.
- The admin email is sent by the `creator-signup-notify` Supabase Edge Function. The key secrets are `RESEND_API_KEY`, `CREATOR_REQUEST_FROM_EMAIL`, `CREATOR_REQUEST_NOTIFICATION_EMAIL`, and `APP_BASE_URL`.
- Fan payment history now lives at `/payments`, combining normal bookings with live queue receipts.
- Avatar uploads only show up where the query explicitly selects `avatar_url` and the UI passes it into `<Avatar imageUrl={...} />`. If a profile photo exists in Settings but initials still show in a view, check that data plumbing first.
