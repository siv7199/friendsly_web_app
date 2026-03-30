# Friendsly — CLAUDE.md

## Project Overview
Friendsly is a monetization platform for micro-influencers. Fans book 1-on-1 video calls or join live queue sessions with creators they follow.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with a custom brand palette
- **Icons**: Lucide React
- **UI Components**: Custom shadcn-style components in `components/ui/`
- **Payments**: Stripe (real PaymentIntents + Elements — test mode active)
- **Backend (future)**: Supabase (Auth + PostgreSQL) + Daily.co (video)
- **Language**: TypeScript (strict mode)

## Folder Structure
```
app/
  (fan)/          — Fan route group (invisible in URL)
    layout.tsx    — Wraps all fan pages with FanSidebar + BottomNav
    discover/     — Grid of creator cards
    profile/[id]/ — Individual creator profile
    waiting-room/[id]/ — Live queue + chat
  (creator)/      — Creator route group
    layout.tsx    — Wraps all creator pages with CreatorSidebar + BottomNav
    dashboard/    — Stats overview + recent bookings
    management/   — Create/edit call packages
    calendar/     — Upcoming and completed bookings
    live/         — Go Live console with queue management

components/
  ui/             — Reusable primitives (Button, Badge, Card, Avatar, Dialog, Input)
  fan/            — Fan-specific components (InfluencerCard, BookingModal, WaitingRoom)
  creator/        — Creator-specific components (StatsCard, BookingList, LiveConsole)
  shared/         — Layout components used in both views (FanSidebar, CreatorSidebar, BottomNav)

lib/
  utils.ts        — cn(), formatCurrency(), formatDate(), statusColor(), timeAgo()
  mock-data.ts    — All fake data (replace with Supabase queries later)

types/
  index.ts        — TypeScript interfaces for Creator, Booking, QueueEntry, ChatMessage, etc.
```

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
2. **Mock data in `lib/mock-data.ts`** — All fake data lives here, never inline in components.
3. **Types in `types/index.ts`** — All shared interfaces defined centrally.
4. **"use client" directive** — Add to the top of any file that uses `useState`, `useEffect`, `usePathname`, or browser events.
5. **Route Groups `(fan)` / `(creator)`** — Parentheses in folder names are invisible in the URL. Used purely for layout organization.
6. **Absolute imports via `@/`** — `import { Button } from "@/components/ui/button"` — never relative `../../`.

## Auth System (Mock — localStorage + Cookies)

**Backend status: Mocked via localStorage + document.cookie**

### Entry Point
`/` (root) is both the Login and Create Account page — a single page with two tabs.
- `/login` and `/signup` redirect to `/` (legacy routes kept to avoid broken links)
- Authenticated users who visit `/` are auto-redirected to their role home

### Auth Routes
```
/                         — Login + Create Account (tabbed, single page)
/onboarding/role          — Pick Fan or Creator (after signup only)
/onboarding/creator-setup — 3-step creator profile form (no pricing — set in /management)
/onboarding/fan-setup     — Simple username form
/settings                 — Account + Billing tabs
```

### Simulated Schema (stored in localStorage key: `mock_profiles`)
```typescript
// Stored as { [userId]: MockProfile } — supports multiple accounts simultaneously

// Common (all users)
{
  id: string              // crypto.randomUUID()
  email: string
  full_name: string
  username: string        // derived from email, editable
  role: "fan" | "creator" | null   // null = pending onboarding
  avatar_initials: string // "Jordan Kim" → "JK"
  avatar_color: string    // Tailwind bg class
  avatar_url?: string     // base64 data URL from profile photo upload (optional)
  created_at: string      // ISO timestamp
}

// Creator-only extra fields
{
  bio: string
  hourly_rate: number     // Reflects cheapest active package price (synced by saveCreatorPackages)
  category: string
  is_live: boolean
}
```

### localStorage Keys (full map)

| Key | Format | Written by | Read by |
|-----|--------|-----------|---------|
| `mock_profiles` | `{ [userId]: profile }` | signup, updateProfile | login, hydration |
| `registered_creators` | `CreatorProfile[]` | saveRegisteredCreator, saveCreatorPackages | getRegisteredCreators, /discover |
| `creator_packages` | `{ [creatorId]: CallPackage[] }` | saveCreatorPackages | getCreatorPackages, /profile/[id] |
| `mock_session_role` (cookie) | `"fan\|uuid"` | setCookieSession | middleware.ts, readCookieSession |

### Creator Registry (stored in localStorage key: `registered_creators`)
When a creator completes onboarding, their `CreatorProfile` is also saved here.
The fan's `/discover` page reads this key and shows real creators in a "New Creators" section.
- `saveRegisteredCreator(profile)` — called at end of creator onboarding
- `getRegisteredCreators()` — called by discover page, returns `Creator[]` display cards
- `saveCreatorPackages(creatorId, packages)` — called by /management on every change; also syncs `hourly_rate` in registered_creators so the Discover price badge stays current
- `getCreatorPackages(creatorId)` — called by /profile/[id] to show the creator's real packages
- New creators show "Packages TBD" + disabled "Coming Soon" button until they add packages in `/management`

### Session Cookie (key: `mock_session_role`)
Format: `"fan|<uuid>"` | `"creator|<uuid>"` | `"pending|<uuid>"`
- Read by `middleware.ts` at the Edge for route protection
- Written/cleared by `lib/mock-auth.ts` setCookieSession / clearCookieSession

### Key Files
```
middleware.ts                    ← Route protection (Edge, reads cookie)
lib/mock-auth.ts                 ← Storage helpers (localStorage + cookie + creator registry)
lib/hooks/useAuth.ts             ← Auth state + methods
lib/context/AuthContext.tsx      ← React Context distribution layer
```

### Onboarding Flow
```
/ (create account tab) → /onboarding/role → /onboarding/fan-setup    → /discover
                                          → /onboarding/creator-setup → /dashboard
                                                    ↓
                                          saveRegisteredCreator() called
                                          → creator appears on fan's /discover
```

## Running the Project
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Stripe Payments

**Status: Live (test mode) — real PaymentIntents, real Stripe Elements card form**

### Flow
1. Fan clicks "Review & Pay" in BookingModal
2. Browser calls `POST /api/create-payment-intent` with amount in cents
3. Server creates a Stripe `PaymentIntent` using `STRIPE_SECRET_KEY` (server-only)
4. Browser receives `client_secret`, mounts `<Elements>` with it
5. Fan enters card details (Stripe handles this — we never see raw card data)
6. `stripe.confirmPayment()` sends card to Stripe, returns success/failure

### Keys (in `.env.local` — never commit to git)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   ← safe in browser code
STRIPE_SECRET_KEY=sk_test_...                    ← server only, never expose
```

### Test cards
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declines
- Any future expiry + any 3-digit CVC

### Key files
- `app/api/create-payment-intent/route.ts` — server-side PaymentIntent creation
- `components/fan/BookingModal.tsx` — `<Elements>`, `<PaymentElement>`, `confirmPayment()`

### Auth pattern — logout vs. deleteAccount
- `logout()` — clears cookie only; profile stays in localStorage so the user can sign back in
- `deleteAccount()` — clears cookie AND deletes profile from localStorage (irreversible)
- Both live in `lib/hooks/useAuth.ts` and are distributed via `AuthContext`

### MockProfile discriminated union
`MockProfile = FanProfile | CreatorProfile | PendingProfile`
- `FanProfile` — `role: "fan"`
- `CreatorProfile` — `role: "creator"`, has bio/hourly_rate/category/is_live
- `PendingProfile` — `role: null`, user signed up but hasn't picked a role yet

## Data Flow (MVP → Production)
| Current (Mock)                            | Future (Real)                              |
|-------------------------------------------|--------------------------------------------|
| `MOCK_CREATORS` array in lib/             | Supabase `creators` table                  |
| `MOCK_BOOKINGS` array                     | Supabase `bookings` table                  |
| `creator_packages` in localStorage        | Supabase `packages` table                  |
| `registered_creators` in localStorage     | Supabase `profiles` table with role filter |
| base64 avatar in localStorage             | Supabase Storage (profile images)          |
| Video placeholder divs                    | Daily.co `<DailyProvider>` + hooks         |
| Client-side auth (localStorage + cookie)  | Supabase Auth + `useUser()` hook           |
| Profile strength calculated client-side   | Supabase computed column or edge function  |
| Stripe test mode (sk_test_ / pk_test_)    | Stripe live mode (sk_live_ / pk_live_)     |

## Demo vs. Real Data — The Rule
All pages check `user?.id === "1"` to distinguish the seeded demo creator (Luna Vasquez) from real signed-up creators:
- Demo creator → sees mock bookings, mock stats, mock queue, mock packages (as seed)
- Real creator → sees empty states until they add their own data
- This check exists in: `dashboard/page.tsx`, `calendar/page.tsx`, `management/page.tsx`, `LiveConsole.tsx`, `waiting-room/[id]/page.tsx`, `CreatorSidebar.tsx`, `settings/page.tsx`

## What Needs `"use client"`
Files that use React hooks or browser APIs need `"use client"` at the top:
- Any component using `useState`, `useEffect`, `useRef`
- Any component using `usePathname()` or `useRouter()` from next/navigation
- Components with event handlers (`onClick`, `onChange`, etc.)

Server Components (no directive needed): layout files, static page files with no interactivity.

## Adding a New Creator Route
1. Create `app/(creator)/your-page/page.tsx`
2. It automatically gets the CreatorSidebar from `app/(creator)/layout.tsx`
3. Add a nav entry in `components/shared/CreatorSidebar.tsx` (NAV_ITEMS array)
4. Add a matching entry in `components/shared/BottomNav.tsx` (CREATOR_ITEMS array)
