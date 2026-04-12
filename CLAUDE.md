# Friendsly Project Reference

This file is the quick project reference.

If `LEARNING.md` is the plain-English guide, this file is the shorter operational summary.

---

## What Friendsly Is

Friendsly is a creator monetization app with two products:

- **1-on-1 bookings**
  - fan books a scheduled private call
  - fan pays up front

- **live queue**
  - creator goes live publicly
  - fans join a queue
  - fans pay only for actual call time

---

## Core Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase
  - Auth
  - Postgres
  - Storage
  - Realtime
- Stripe
- Daily.co

---

## Most Important Business Rules

### Bookings
- same-day booking is blocked
- creator cannot be double-booked
- fan cannot overlap bookings across creators
- join window opens 5 minutes early
- public shareable booking links now exist at `/book/[creatorSlug]`
- public flow supports sign in, fan signup, or guest checkout
- guest bookings return through `/booking-access/[token]`
- guests join calls through `/guest-room/[token]`

### Refunds
- fan cancel >24h -> 100% refund
- fan cancel <24h -> 50% refund
- creator cancel -> 100% refund
- both absent -> 100% refund
- creator joins, fan no-show -> 50% refund
- fan joins, creator no-show -> 100% refund
- these same refund/no-show outcomes are now surfaced on the guest booking access page too

### Guest booking behavior
- guest bookings create `guest_contacts`, `guest_checkout_sessions`, and `booking_access_tokens`
- `bookings` now supports `booking_owner_type = 'guest'`
- guest booking access page supports:
  - current refund messaging
  - auto-cancel policy messaging
  - cancel action for upcoming bookings
  - rebook action for completed/cancelled bookings
- guest room now uses real Daily video tiles, not a placeholder shell
- if the creator ends a guest booking, the guest room exits and redirects back to booking access

### Reviews
- only after completed booking
- one review per completed booking
- booking ID is attached server-side, not entered by the fan

### Creator requests
- creator request is manually reviewed
- pending/rejected creator-request-only users cannot log in
- approved creators can log in normally

### Live queue
- one fan can only have one open queue row per live session
- admit does not equal joined
- live timer should start from actual room join, not just admit

---

## Current Payout Model

- Friendsly receives customer money first
- creator share is tracked in app logic
- creator should only withdraw cleared / safe money
- Stripe-safe available balance matters
- creators should not see raw platform Stripe balance numbers

Main payout files:
- `app/(creator)/earnings/page.tsx`
- `app/api/creator-payouts/withdraw/route.ts`
- `lib/server/payouts.ts`

---

## Main Folder Map

```text
app/
  (fan)/
  (creator)/
  api/

components/
  fan/
  creator/
  shared/
  ui/

lib/
types/
supabase/
```

---

## Most Important Files

### Auth
- `app/page.tsx`
- `lib/hooks/useAuth.ts`
- `middleware.ts`
- `app/api/auth/prelogin-status/route.ts`

### Bookings
- `components/fan/BookingModal.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/availability/route.ts`
- `lib/server/bookings.ts`
- `components/public/PublicBookingFlow.tsx`
- `app/api/public/creators/[creatorSlug]/route.ts`
- `app/api/public/bookings/availability/route.ts`
- `app/api/public/guest-checkout/session/route.ts`
- `app/api/public/create-payment-intent/route.ts`
- `app/api/public/bookings/route.ts`
- `app/api/public/booking-access/[token]/route.ts`
- `app/api/public/booking-access/[token]/cancel/route.ts`
- `app/api/public/booking-access/[token]/join/route.ts`
- `app/api/public/booking-access/[token]/presence/route.ts`
- `lib/server/booking-access.ts`

### Live queue
- `components/creator/LiveConsole.tsx`
- `components/fan/LiveJoinModal.tsx`
- `app/(fan)/waiting-room/[id]/page.tsx`
- `app/api/live/mark-active-joined/route.ts`

### Reviews
- `app/api/reviews/route.ts`
- `app/(fan)/profile/[id]/page.tsx`

### Creator request flow
- `app/onboarding/creator-request/page.tsx`
- `app/api/creator-signup-request/route.ts`
- `app/creator-request/review/page.tsx`
- `supabase/functions/creator-signup-notify/index.ts`

### Payouts
- `app/(creator)/earnings/page.tsx`
- `app/api/creator-payouts/withdraw/route.ts`
- `lib/server/payouts.ts`

---

## Database Tables That Matter Most

- `profiles`
- `creator_profiles`
- `call_packages`
- `creator_availability`
- `bookings`
- `guest_contacts`
- `guest_checkout_sessions`
- `booking_access_tokens`
- `live_sessions`
- `live_queue_entries`
- `reviews`
- `payouts`
- `creator_signup_requests`

---

## Important Migrations

- `001_initial.sql`
- `024_booking_attendance_tracking.sql`
- `025_stripe_connect_payouts.sql`
- `026_booking_guardrails.sql`
- `027_live_queue_guardrails.sql`
- `028_shareable_booking_guest_access.sql`

If something feels wrong in production behavior, always check whether the latest migrations were actually applied.

---

## Current Operational Notes

- Avatar uploads now use storage-backed URLs instead of giant base64 strings.
- Review avatars only show where queries explicitly select `avatar_url` and pass it to `Avatar`.
- Creator request socials are optional.
- The creator-request success state no longer offers “Explore as a fan.”
- Auth page uses `Show/Hide` text instead of the broken eye icon.
- The native Edge password reveal control is hidden in CSS.

---

## Useful Commands

```bash
npm run dev
npx tsc --noEmit
git status
```

---

## When Debugging, Ask

1. Is this a frontend problem, backend problem, or database problem?
2. Which file renders the screen?
3. Which file enforces the rule?
4. Is the DB state consistent with what the UI is showing?

That is usually enough to find the real issue fast.
