# Friendsly Learning Guide

This guide is written for someone who is strong in data thinking but not deep in web engineering yet.

If you are coming from data science, the best way to think about this project is:

- the **frontend** is the part users see and click
- the **backend** is the part that checks rules, talks to Stripe/Supabase, and saves data
- the **database** is where the app's memory lives
- **APIs** are the little doors the frontend uses to ask the backend to do something

This guide is meant to help you understand the project at a practical level, not turn you into a computer science major overnight.

---

## Table of Contents
1. [What This App Actually Does](#1-what-this-app-actually-does)
2. [The Main Tech Stack in Plain English](#2-the-main-tech-stack-in-plain-english)
3. [How the App Is Organized](#3-how-the-app-is-organized)
4. [How Routing Works](#4-how-routing-works)
5. [Frontend vs Backend vs Database](#5-frontend-vs-backend-vs-database)
6. [How Authentication Works](#6-how-authentication-works)
7. [How Booking Calls Work](#7-how-booking-calls-work)
8. [How Live Queue Calls Work](#8-how-live-queue-calls-work)
9. [How Payments and Refunds Work](#9-how-payments-and-refunds-work)
10. [How Creator Payouts Work](#10-how-creator-payouts-work)
11. [How Reviews Work](#11-how-reviews-work)
12. [How Profile Photos Work](#12-how-profile-photos-work)
13. [How to Read the Codebase Without Getting Lost](#13-how-to-read-the-codebase-without-getting-lost)
14. [Most Important Files](#14-most-important-files)
15. [Glossary](#15-glossary)
16. [How a Shareable Booking Link Could Work](#16-how-a-shareable-booking-link-could-work)

---

## 1. What This App Actually Does

Friendsly has two core products:

### 1-on-1 bookings
- A fan books a private call with a creator.
- The fan pays up front.
- The call happens at a scheduled time.

### Live queue
- A creator goes live publicly.
- Fans join a queue.
- Fans only pay for the time they actually spend talking to the creator.

That is the whole business in one sentence:

**Fans pay for access to creators through either scheduled calls or live queue calls.**

---

## 2. The Main Tech Stack in Plain English

### Next.js
This is the main web framework.

You can think of it as:
- React for the screens
- plus routing
- plus server features
- plus deployment-friendly structure

### TypeScript
This is JavaScript with guardrails.

It helps catch mistakes like:
- using the wrong field name
- passing the wrong kind of data
- forgetting that something can be missing

### Tailwind CSS
This is how the app is styled.

Instead of separate CSS files for every component, many styles are written directly in the JSX with utility classes like:
- `p-4`
- `rounded-xl`
- `text-sm`
- `bg-brand-surface`

### Supabase
This gives us:
- authentication
- database
- storage
- realtime subscriptions

In plain English:
- Supabase is the main backend data platform

### Stripe
This handles payments:
- booking payments
- live queue card holds and charges
- creator payout plumbing

### Daily.co
This handles video rooms and live call sessions.

---

## 3. How the App Is Organized

The biggest folders:

```text
app/
components/
lib/
types/
supabase/
```

### `app/`
This is where routes/pages live.

Examples:
- `app/page.tsx` = login page
- `app/(fan)/discover/page.tsx` = fan discover page
- `app/(creator)/dashboard/page.tsx` = creator dashboard

### `components/`
Reusable UI building blocks.

Examples:
- modals
- sidebars
- cards
- forms

### `lib/`
Shared logic that is not a page.

Examples:
- auth helpers
- Stripe helpers
- payout calculations
- booking logic

### `types/`
Shared TypeScript shapes.

Examples:
- what a `Creator` object looks like
- what a `Booking` object looks like

### `supabase/`
Database migrations and edge functions.

Examples:
- SQL files that create or update tables
- email/notification serverless functions

---

## 4. How Routing Works

In Next.js App Router:

- folders create URLs
- `page.tsx` means “this folder is a page”

Examples:

```text
app/page.tsx                       -> /
app/(fan)/discover/page.tsx       -> /discover
app/(creator)/dashboard/page.tsx  -> /dashboard
app/(fan)/profile/[id]/page.tsx   -> /profile/:id
```

### What are `(fan)` and `(creator)`?
Those are **route groups**.

They help organize the project, but they do not appear in the URL.

So:

```text
app/(fan)/discover/page.tsx -> /discover
```

not:

```text
/fan/discover
```

---

## 5. Frontend vs Backend vs Database

This is the most important mental model in the whole project.

### Frontend
What the user sees.

Examples:
- buttons
- forms
- pages
- modals
- labels

Examples in this project:
- `components/fan/BookingModal.tsx`
- `app/(fan)/profile/[id]/page.tsx`

### Backend
The protected logic.

This is where we enforce rules like:
- can this fan book this slot?
- is this booking refundable?
- can this creator withdraw money?
- is this user allowed to review?

Examples in this project:
- `app/api/bookings/route.ts`
- `app/api/reviews/route.ts`
- `app/api/creator-payouts/withdraw/route.ts`

### Database
The stored truth.

This is where records live:
- users
- bookings
- reviews
- live sessions
- payouts

Examples:
- `profiles`
- `bookings`
- `live_sessions`
- `live_queue_entries`

### Good rule of thumb

If a rule matters for money, access, or trust:

**it must be enforced in the backend/database, not only in the frontend**

---

## 6. How Authentication Works

Authentication means:
- who is signed in?
- are they a fan or creator?
- should they be allowed into this page?

Main files:
- `lib/hooks/useAuth.ts`
- `lib/context/AuthContext.tsx`
- `middleware.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

### Login flow
1. User enters email and password.
2. Supabase verifies the credentials.
3. The app loads the user profile.
4. Middleware and client logic decide where they should go next.

### Role flow
A user can be:
- `fan`
- `creator`
- or `null` during setup/review states

### Current creator approval rule
Creator-request-only users are now blocked from logging in until approved.

That means:
- approved creator -> can log in
- normal fan -> can log in
- creator request pending/rejected with no approved role -> cannot log in

---

## 7. How Booking Calls Work

A booking is a normal scheduled private call.

### Main idea
- fan picks a package
- fan picks a time
- fan pays up front
- the call happens later

### Important booking rules
- same-day booking is blocked
- creator cannot be double-booked
- fan cannot overlap bookings with multiple creators
- join window opens 5 minutes before the call

### Main booking files
- `components/fan/BookingModal.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/availability/route.ts`
- `lib/server/bookings.ts`

### Statuses you will see
- `upcoming`
- `live`
- `completed`
- `cancelled`

---

## 8. How Live Queue Calls Work

Live queue is different from bookings.

### Main idea
- creator starts a public live session
- fans join the queue
- creator admits one fan at a time
- fan pays only for actual talk time

### Core tables
- `live_sessions`
- `live_queue_entries`
- `live_chat_messages`

### Important rule
A fan should only have **one open queue entry per live session**.

That is why we added:
- frontend guard in `components/fan/LiveJoinModal.tsx`
- DB guard in `supabase/migrations/027_live_queue_guardrails.sql`

### Main live files
- `components/creator/LiveConsole.tsx`
- `components/fan/LiveJoinModal.tsx`
- `app/(fan)/waiting-room/[id]/page.tsx`
- `app/api/live/mark-active-joined/route.ts`
- `app/api/live/finalize-charge/route.ts`

---

## 9. How Payments and Refunds Work

### Booking payments
Bookings are paid in full up front.

### Refund rules currently implemented

#### Fan cancels more than 24 hours before
- fan gets 100% refund
- creator gets nothing

#### Fan cancels within 24 hours
- fan gets 50% refund
- remaining 50% is retained
- creator gets 85% of the retained amount
- Friendsly gets 15% of the retained amount

#### Creator cancels
- fan gets 100% refund
- creator gets nothing

#### Both miss the call
- fan gets 100% refund
- creator gets nothing

#### Creator joins, fan no-shows
- fan gets 50% refund
- creator gets share of retained amount

#### Fan joins, creator no-shows
- fan gets 100% refund
- creator gets nothing

### Important business concept
The creator should not be able to withdraw money that is still at refund risk.

So:
- earned money
- pending money
- withdrawable money

are not always the same thing.

---

## 10. How Creator Payouts Work

### Business model
- Friendsly receives the full customer payment first
- Friendsly keeps its platform share
- Friendsly later pays creators their share

### Current safer rule
Creator payouts should only use money that is actually safe to withdraw.

That means the UI now tries to respect:
- cleared creator earnings
- Stripe-safe platform balance

### Important truth
Just because the app says a creator earned something does not mean Stripe says it is ready to move right now.

That is why payout logic is tricky.

### Main payout files
- `app/(creator)/earnings/page.tsx`
- `app/api/creator-payouts/withdraw/route.ts`
- `lib/server/payouts.ts`

---

## 11. How Reviews Work

### Current rule
A fan can review only when:
- they had a completed booking
- that booking belongs to them
- that booking is for that creator
- that booking has not already been reviewed

### Important nuance
The fan does **not** manually enter a booking ID.

Instead:
- frontend sends creator + review text
- backend finds an eligible completed booking
- backend attaches the booking ID automatically

### Main files
- `app/api/reviews/route.ts`
- `app/(fan)/profile/[id]/page.tsx`

### Current UX
- review form only shows when an eligible completed booking exists
- otherwise the fan sees a message explaining reviews unlock after completed calls

---

## 12. How Profile Photos Work

### Old problem
The app used to store large base64 images directly in profile rows.

That caused:
- egress waste
- bloated auth metadata
- cookie/header problems

### Current approach
New avatar uploads go to storage.

Then profile rows store a lighter image URL/path.

### Important debugging rule
If a photo exists but initials are still showing, check two things:
1. did the query select `avatar_url`?
2. did the UI pass `imageUrl={...}` into the `Avatar` component?

Main files:
- `app/api/profile/avatar/route.ts`
- `lib/avatar-upload.ts`
- `components/ui/avatar.tsx`

---

## 13. How to Read the Codebase Without Getting Lost

Best reading order:

### If you want to understand login
- `app/page.tsx`
- `lib/hooks/useAuth.ts`
- `middleware.ts`

### If you want to understand bookings
- `components/fan/BookingModal.tsx`
- `app/api/bookings/route.ts`
- `lib/server/bookings.ts`

### If you want to understand live queue
- `components/creator/LiveConsole.tsx`
- `components/fan/LiveJoinModal.tsx`
- `app/(fan)/waiting-room/[id]/page.tsx`

### If you want to understand payouts
- `app/(creator)/earnings/page.tsx`
- `app/api/creator-payouts/withdraw/route.ts`
- `lib/server/payouts.ts`

### If you want to understand reviews
- `app/(fan)/profile/[id]/page.tsx`
- `app/api/reviews/route.ts`

---

## 14. Most Important Files

### High-level app structure
- `app/page.tsx`
- `app/(fan)/discover/page.tsx`
- `app/(creator)/dashboard/page.tsx`

### Auth
- `lib/hooks/useAuth.ts`
- `middleware.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

### Bookings
- `components/fan/BookingModal.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/availability/route.ts`
- `lib/server/bookings.ts`

### Live queue
- `components/creator/LiveConsole.tsx`
- `components/fan/LiveJoinModal.tsx`
- `app/(fan)/waiting-room/[id]/page.tsx`

### Payments / payouts
- `app/api/create-payment-intent/route.ts`
- `app/api/create-live-preauth/route.ts`
- `app/api/creator-payouts/withdraw/route.ts`
- `lib/server/payouts.ts`
- `lib/server/stripe.ts`

### Reviews
- `app/api/reviews/route.ts`
- `app/(fan)/profile/[id]/page.tsx`

### Database
- `supabase/migrations/001_initial.sql`
- `supabase/migrations/026_booking_guardrails.sql`
- `supabase/migrations/027_live_queue_guardrails.sql`

---

## 15. Glossary

### App Router
Next.js folder-based routing system.

### Client Component
A component that runs in the browser and can use interactivity like `useState`.

### Server Component
A component that runs on the server by default.

### API Route
A backend endpoint inside `app/api/...`.

### Supabase
Backend platform for auth, database, storage, and realtime.

### Stripe PaymentIntent
Stripe object representing a payment flow.

### Pre-authorization
A temporary card hold before the final charge amount is known.

### Realtime
Supabase event updates that help pages react automatically to DB changes.

### Migration
A SQL file that changes the database schema or adds DB rules.

### RLS
Row Level Security. Database rules controlling who can read or change which rows.

---

## Final Advice

If you ever feel lost, ask these three questions:

1. Is this a frontend problem, backend problem, or database problem?
2. Which file is the screen?
3. Which file is the rule?

That framing will save you a lot of pain in this project.

---

## 16. How a Shareable Booking Link Could Work

This section describes the shareable booking flow that is now implemented in the app.

### Main product idea

A creator can share a public booking link like:

```text
/book/sarah
```

That page is public. A fan does not need to be signed in just to view the creator, offers, pricing, and open booking times.

The big UX goal is still:

**make the first booking feel like checkout, not like joining a platform**

---

### Current fan flow

The implemented flow is:

1. Fan opens `/book/[creatorSlug]`.
2. Fan chooses a package, date, and time.
3. Fan adds an optional topic.
4. Fan chooses how to continue:
   - sign in
   - create a fan account
   - continue as guest
5. Fan pays.
6. Friendsly creates the booking.
7. If the fan booked as guest, Friendsly gives them a private booking access link.

Important detail:

The slot selection happens before the identity decision. That means the fan sees the value and picks a time before we ask them to log in or continue as guest.

---

### Current routes

Main routes for this feature:
- `app/book/[creatorSlug]/page.tsx`
- `app/booking-access/[token]/page.tsx`
- `app/guest-room/[token]/page.tsx`

In plain English:
- `/book/...` = public checkout page
- `/booking-access/...` = guest return page
- `/guest-room/...` = guest video room page

---

### If the fan already has a Friendsly account

If the fan is already a signed-in fan:
- the public page lets them continue directly to payment
- payment uses the normal authenticated booking APIs
- the booking is attached to their existing account
- they later join through the normal signed-in booking flow

This means the new shareable link feature does not replace the existing booking system. It adds a public entry point into it.

---

### If the fan does not have an account

The public page now offers:
- sign in
- create fan account
- continue as guest

This is the important conversion choice.

Instead of blocking first-time users behind a hard signup wall, we let them finish the purchase as a guest if they want.

---

### How guest bookings work now

Guest bookings use new backend records:
- `guest_contacts`
- `guest_checkout_sessions`
- `booking_access_tokens`

And the `bookings` table now supports guest-owned bookings using:
- `guest_contact_id`
- `booking_owner_type`
- guest snapshot fields like name/email at booking time

This means a guest booking is still tied to a real identity record, but not to a normal Friendsly account.

---

### What a guest provides

For the current implementation, a guest provides:
- full name
- email
- optional phone

Then Friendsly:
1. creates or updates a guest contact
2. creates a guest checkout session
3. creates a guest payment intent
4. creates the final booking after successful payment
5. generates a secure booking access token

---

### How guest users return later

Current implementation:

A guest returns through a secure private link like:

```text
/booking-access/[token]
```

That page shows:
- booking details
- creator info
- topic
- whether the room is open yet
- a `Join call` button when the join window opens

Important note:

The current implementation uses **secure booking links**, not email OTP or magic-link auth.

That is simpler for V1 and works well enough for a private access flow, but it is not the same thing as a full passwordless login system.

---

### How guest joining works now

When the guest opens their booking access page and the room is joinable:
- they go to `/guest-room/[token]`
- the app validates the token through a public API route
- the server checks the booking timing rules
- the server creates or reuses the Daily room
- the guest joins the call without needing a normal Friendsly account

Guest room presence is still tracked so the booking lifecycle remains compatible with the normal booking rules.

---

### How account creation handoff works

If the fan chooses:
- `Sign in`
- or `Create a fan account`

the app sends them through the existing auth flow, but now preserves the booking continuation route using `next`.

Updated places:
- `app/page.tsx`
- `app/onboarding/role/page.tsx`
- `app/onboarding/fan-setup/page.tsx`

That means a user can start on a shareable booking page, authenticate, finish any required fan setup, and then return to the same booking flow instead of getting lost in generic onboarding.

---

### Current guest booking policy communication

The guest booking access page now communicates both cancellation and no-show outcomes more explicitly.

Current guest-visible policy:
- cancel more than 24 hours before the call -> full refund
- cancel within 24 hours -> 50% refund
- if neither participant joins within 5 minutes after the scheduled start -> auto-cancel + full refund
- if only the creator joins and the fan/guest never shows -> auto-cancel + 50% refund
- if only the fan/guest joins and the creator never shows -> auto-cancel + full refund

The guest page also shows the guest's current refund amount if they cancel now.

---

### New APIs added for the shareable flow

Main public APIs:
- `app/api/public/creators/[creatorSlug]/route.ts`
- `app/api/public/bookings/availability/route.ts`
- `app/api/public/guest-checkout/session/route.ts`
- `app/api/public/create-payment-intent/route.ts`
- `app/api/public/bookings/route.ts`
- `app/api/public/booking-access/[token]/route.ts`
- `app/api/public/booking-access/[token]/join/route.ts`
- `app/api/public/booking-access/[token]/presence/route.ts`

In plain English:
- some APIs load public creator/availability data
- some APIs create guest payment + guest bookings
- some APIs validate guest access and let the guest join the room

---

### Creator-facing addition

The creator dashboard now exposes a shareable booking link card so creators can:
- copy their public booking link

That lives on:
- `app/(creator)/dashboard/page.tsx`

The preview action was later removed so the dashboard now keeps this simpler:
- copy public booking link

---

### Guest booking lifecycle behavior

The guest flow now supports more than just booking creation.

Implemented lifecycle behavior:
- guest gets a private booking access link after successful payment
- guest can view booking details on `/booking-access/[token]`
- guest can cancel from that page if the booking is still upcoming
- guest sees refund policy and auto-cancel policy on that page
- guest joins the Daily room through `/guest-room/[token]`
- if the creator ends the booking, the guest room exits and returns the guest to the booking access page
- if the booking is completed or cancelled, the guest booking page now reflects that instead of always saying the booking is ready

This matters because guest bookings now behave much more like first-class bookings, even though the guest does not have a standard Friendsly account.

---

### Current limitations

This first implementation is intentionally practical, not final.

Current limitations:
- guest return uses a secure access link instead of OTP or magic-link auth
- guest recovery is not a full self-serve account recovery system yet
- confirmation/reminder email delivery is not the main mechanism for access in this build
- the public shareable flow is separate from the signed-in `BookingModal` flow

That separation is actually a good thing for now because it keeps the public funnel simpler and avoids overcomplicating the existing in-app booking modal.

---

### Why this structure matters

This feature creates a new top-of-funnel path for bookings:

- before: most booking logic assumed a signed-in fan
- now: a creator can share one public link and fans can still get to payment quickly

That is a product shift, not just a new page.

It means Friendsly now supports:
- in-app signed-in bookings
- public creator share links
- guest bookings with secure return access

---

### One simple product sentence

**A creator can now share one public booking link, and any fan can use it to book a call through sign-in, fan account creation, or guest checkout, then return later through a secure booking link to view and join the call.**
