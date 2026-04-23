# Friendsly — How This App Actually Works

> Written for someone who understands data science, product thinking, and business — but is newer to web app engineering. Every concept is explained in plain English with real examples from this codebase.

---

## Table of Contents

1. [What Friendsly Does](#1-what-friendsly-does)
2. [How the App Is Structured](#2-how-the-app-is-structured)
3. [Frontend vs Backend — What Runs Where](#3-frontend-vs-backend--what-runs-where)
4. [Key Technical Concepts in Plain English](#4-key-technical-concepts-in-plain-english)
5. [Endpoints and APIs](#5-endpoints-and-apis)
6. [The Database](#6-the-database)
7. [Major Flows, Step by Step](#7-major-flows-step-by-step)
8. [External Services](#8-external-services)
9. [Security and Risk Basics](#9-security-and-risk-basics)
10. [How to Understand This App If You Come From Data Science / Business](#10-how-to-understand-this-app-if-you-come-from-data-science--business)
11. [Common Patterns in This Codebase](#11-common-patterns-in-this-codebase)
12. [Where to Look First When Debugging](#12-where-to-look-first-when-debugging)
13. [How to Trace a Feature Through the Codebase](#13-how-to-trace-a-feature-through-the-codebase)
14. [If You Only Remember 10 Things](#14-if-you-only-remember-10-things)
15. [Glossary](#15-glossary)
16. [Questions to Ask Next](#16-questions-to-ask-next)

---

## 1. What Friendsly Does

Friendsly is a **creator monetization marketplace**. It lets fans pay creators for personal access in two formats:

### Product 1 — 1-on-1 Bookings
A fan schedules a private video call with a creator in advance. The fan picks a time, selects a package (e.g. "15-minute call — $50"), pays upfront, and shows up at the scheduled time. Think Calendly + Zoom, but the payment is built in.

### Product 2 — Live Queue
The creator goes live publicly. Fans see the creator is live, pay a join fee, and enter a queue. They get admitted one at a time for a short turn (up to 5 minutes). It's like a paid digital meet-and-greet — fans take turns getting face time.

### The Two Users
- **Fans** — discover creators, browse profiles, book calls, join live queues, pay with a card, leave reviews
- **Creators** — set up a profile, define available packages and times, go live, manage their calendar, receive payouts

### What Fans See
- A discovery feed of creators (`/discover`)
- A creator's public booking page (`/book/[creatorSlug]`)
- Their own bookings list (`/bookings`)
- A waiting room during live events (`/waiting-room/[creatorId]`)

### What Creators See
- A dashboard with earnings, upcoming calls, and ratings (`/dashboard`)
- A live control console for managing the queue (`/live`)
- A calendar and availability editor (`/calendar`)
- An earnings and payout page (`/earnings`)

---

## 2. How the App Is Structured

### The Folder Map

```
Friendsly_web_app/
│
├── app/                    ← Every page and API lives here
│   ├── (fan)/              ← Pages only fans see (discover, bookings, waiting room)
│   ├── (creator)/          ← Pages only creators see (dashboard, live, earnings)
│   ├── api/                ← The backend: all server-side logic
│   ├── book/               ← Public booking page (no login required to view)
│   └── ...                 ← Other pages (login, onboarding, room)
│
├── components/             ← Reusable UI building blocks
│   ├── fan/                ← Fan-specific UI (BookingModal, LiveJoinModal)
│   ├── creator/            ← Creator-specific UI (LiveConsole, BookingList)
│   ├── shared/             ← Used by both (navigation, avatars, brand logo)
│   └── ui/                 ← Generic building blocks (buttons, cards, dialogs)
│
├── lib/                    ← Shared logic (not UI, not pages)
│   ├── server/             ← Code that can ONLY run on the server (uses secret keys)
│   ├── hooks/              ← React hooks (reusable logic for components)
│   ├── context/            ← App-wide shared state (auth, user session)
│   └── supabase/           ← Database connection helpers
│
├── supabase/
│   └── migrations/         ← The history of how the database was built, in order
│
└── middleware.ts           ← The app's "bouncer" — runs before every page request
```

### The Parentheses Folders Are "Route Groups"

In Next.js, folders wrapped in parentheses like `(fan)` and `(creator)` are organizational — the parentheses don't appear in the URL. So `app/(fan)/discover/page.tsx` is the page at `/discover`. This is just a way to keep fan pages and creator pages separate without changing URLs.

---

## 3. Frontend vs Backend — What Runs Where

This is one of the most important concepts to grasp. In Friendsly, the same codebase handles both the visual interface (what the user sees) and the server logic (what handles data and payments). Next.js makes this possible.

### In the Browser (Frontend)
- Renders the UI: buttons, layouts, animations
- Reacts to user actions (clicks, form inputs)
- Holds temporary "state" — like which tab is selected, or what the user typed
- Makes requests to the backend to get or send data
- Never touches the database directly
- Never uses secret API keys

Examples: `components/fan/BookingModal.tsx`, `app/(fan)/discover/page.tsx`

### On the Server (Backend)
- Handles all logic involving money, auth, and data
- Talks to the database (Supabase), payment processor (Stripe), and video platform (Daily)
- Uses secret keys that must never be visible to users
- Returns data to the browser as JSON responses

Examples: Everything in `app/api/`, and all files in `lib/server/`

### The Rule of Thumb
If a file uses `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `DAILY_API_KEY` — it runs on the server. If it uses `NEXT_PUBLIC_*` variables or imports React hooks like `useState` — it runs in the browser.

---

## 4. Key Technical Concepts in Plain English

### API (Application Programming Interface)
An API is a set of defined ways one piece of software can talk to another. In Friendsly, the frontend (browser) talks to the backend (server) through an API — it sends requests, the server processes them and sends back responses.

Think of it like a restaurant menu: the menu defines what you can order (the API). You place an order (make a request). The kitchen (server) prepares it and brings it back (response).

### Endpoint
An endpoint is a specific URL the server listens on and knows how to respond to.

Examples from this codebase:
- `POST /api/bookings` — create a booking
- `GET /api/reviews?creatorId=abc` — get reviews for a creator

"POST" and "GET" describe the type of request. GET = "give me data." POST = "do something with this data I'm sending."

### Route
In Next.js, a "route" is just a file in the `app/` folder. The file path becomes the URL. So `app/api/bookings/route.ts` is the code that runs when anyone calls `/api/bookings`.

### Component
A component is a reusable piece of UI — like a LEGO brick. `BookingModal.tsx` is a component. It can be dropped into any page that needs a booking dialog. Components accept "props" (inputs) and return HTML to display.

### State
State is data that a component holds in memory while the user is on the page. For example, in the booking modal, the "selected date" is state — it changes when the user clicks a different date, and the UI updates. State lives in the browser only; it disappears on refresh.

### Props
Props are the inputs you pass into a component, like arguments to a function. If you render `<BookingModal creator={alice} />`, then `creator` is a prop.

### Database Query
A database query is a question asked to the database. In Friendsly, this looks like:
```typescript
await supabase.from("bookings").select("*").eq("fan_id", user.id)
```
Which means: "From the bookings table, give me all rows where fan_id equals my user ID."

### Auth (Authentication)
Auth is confirming *who* you are. In Friendsly, users sign in with email + password (or Google/Apple OAuth). Supabase handles this and issues a JWT — a signed token that proves the user is who they say they are.

### Authorization
Authorization is confirming *what you are allowed to do*. Even after you prove who you are, the server checks whether you're allowed to take each specific action. For example, only the creator who owns a live session can end it — even a logged-in fan cannot.

In this codebase, authorization checks appear in every important API route:
```typescript
if (user.id !== creatorId) {
  return NextResponse.json({ error: "Only the creator can end this live session." }, { status: 403 });
}
```

### Webhook
A webhook is a notification sent from an external service to your server when something happens. Instead of your server constantly asking Stripe "has this payment succeeded yet?", Stripe calls your server automatically when the status changes.

In Friendsly: `app/api/stripe/webhook/route.ts` receives events from Stripe (like when a creator's Connect account is updated).

### Middleware
Middleware is code that runs *before* every request reaches its destination. `middleware.ts` is the bouncer. Before a user reaches `/earnings`, the middleware checks if they're logged in and have the right role. If not, they get redirected.

### Environment Variables
Environment variables are secret configuration values stored outside the code. They look like:
- `STRIPE_SECRET_KEY=sk_live_...`
- `SUPABASE_SERVICE_ROLE_KEY=eyJ...`

They're never committed to git. They're set on the server (Vercel) separately from the code. Public variables start with `NEXT_PUBLIC_` and are safe to send to the browser. Secret ones do not have this prefix.

### Client-side vs Server-side
- **Client-side**: runs in the user's browser. Fast and interactive. Cannot access secrets or the database directly.
- **Server-side**: runs on Vercel's computers. Can access databases and secret keys. Users never see this code.

### Realtime
Realtime means the UI updates automatically when data changes, without the user refreshing. In Friendsly, the live queue uses Supabase Realtime — when a fan joins the queue or the creator admits someone, everyone's screen updates instantly.

### Caching
This app does not use aggressive caching. Most pages fetch fresh data on load. The one important "freshness" check is the live session heartbeat — `last_heartbeat_at` must be within 45 seconds, otherwise the session is considered stale and the creator is shown as offline.

---

## 5. Endpoints and APIs

### Endpoint Quick Reference

#### Auth
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/auth/prelogin-status` | POST | None | Before login: checks if an email is blocked (pending/rejected creator application) |

#### Bookings
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/bookings` | POST | Fan | Creates a booking after verifying payment succeeded |
| `/api/bookings/[id]/late-fee` | POST | Fan | Creates a late-fee charge, or confirms one was paid |

#### Payments
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/create-payment-intent` | POST | Fan | Creates a Stripe pending charge for a booking |
| `/api/create-live-preauth` | POST | Fan | Creates a Stripe hold (not yet charged) for a live queue join |

#### Live Queue
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/live/join-queue` | POST | Fan | Adds fan to live queue after verifying the payment hold |
| `/api/live/mark-active-joined` | POST | Fan | Records the exact moment a fan enters the Daily video room |
| `/api/live/finalize-charge` | POST | Creator | Captures the exact charge when a fan's turn ends |
| `/api/live/disconnect` | POST | Creator | Emergency endpoint: ends session, refunds waiting fans, settles active fan |
| `/api/end-live-session` | POST | Creator | Gracefully ends the creator's entire live session |

#### Video (Daily)
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/daily/room` | POST | Creator only | Creates a new private Daily video room + owner token for the creator |
| `/api/daily/token` | POST | Admitted fan | Issues a Daily meeting token — only works if the fan has an active queue entry |

#### Creator Payouts
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/creator-payouts/status` | GET | Creator | Returns earnings summary, payout history, Stripe Connect status |
| `/api/creator-payouts/onboarding` | POST | Creator | Starts Stripe Connect onboarding (returns Stripe's hosted signup URL) |
| `/api/creator-payouts/withdraw` | POST | Creator | Transfers available balance to creator's bank |
| `/api/creator-payouts/dashboard` | POST | Creator | Returns a login link to the creator's Stripe Express dashboard |

#### Public (No Login Required to Call)
| Endpoint | Method | What it does |
|---|---|---|
| `/api/public/creators/[creatorSlug]` | GET | Returns creator profile, packages, and availability |
| `/api/public/bookings/availability` | GET | Returns available time slots for a creator |
| `/api/public/booking-access/[token]/claim` | POST (fan must be signed in) | Lets a signed-in fan claim a legacy guest booking |

#### Retired Guest Checkout (All Return 410 Gone)
`/api/public/bookings`, `/api/public/create-payment-intent`, `/api/public/guest-checkout/session`, `/api/public/booking-access/[token]/cancel`, `/api/public/booking-access/[token]/presence`, `/api/public/booking-access/[token]/late-fee`

#### Other
| Endpoint | Method | Auth | What it does |
|---|---|---|---|
| `/api/reviews` | GET | Fan | Checks if a fan can review a creator (has a completed, unreviewed booking) |
| `/api/reviews` | POST | Fan | Submits a review |
| `/api/profile/avatar` | POST | Any user | Uploads a new avatar image |
| `/api/profile/avatar` | DELETE | Any user | Removes the avatar |
| `/api/creator-signup-request` | POST | None | Submits a creator application |
| `/api/stripe/webhook` | POST | Stripe only | Receives and verifies Stripe event notifications |

---

### What a Request and Response Actually Look Like

**Example: Creating a booking (`POST /api/bookings`)**

The browser sends:
```json
{
  "creatorId": "uuid-of-creator",
  "packageId": "uuid-of-package",
  "scheduledAt": "2026-05-01T14:00:00.000Z",
  "topic": "I want advice on my startup",
  "paymentIntentId": "pi_abc123"
}
```

The server checks before doing anything:
1. Is the user logged in?
2. Are the UUIDs valid format?
3. Does this package exist and belong to this creator?
4. Is the time slot still open (no conflicts)?
5. Does the PaymentIntent belong to *this* user?
6. Does the PaymentIntent amount exactly match the package price?
7. Has the payment actually succeeded in Stripe?
8. Has this PaymentIntent already been used for another booking?

If all eight pass, the server responds:
```json
{
  "booking": {
    "id": "new-uuid",
    "creator_id": "...",
    "fan_id": "...",
    "scheduled_at": "2026-05-01T14:00:00.000Z",
    "duration": 30,
    "price": 51.25,
    "status": "upcoming"
  }
}
```

---

## 6. The Database

The database is PostgreSQL, hosted by Supabase. Every table has Row Level Security (RLS) — meaning Supabase enforces access rules at the database level. Even if application code had a bug, the database won't return data the requesting user isn't allowed to see.

### Main Tables

#### `profiles`
The base user record. Every user (fan or creator) has one row.
- `id` — matches Supabase Auth user ID (UUID)
- `email`, `full_name`, `username`
- `role` — `"fan"` or `"creator"`
- `avatar_url` — link to their uploaded photo

#### `creator_profiles`
Extra data only creators have. One row per creator, same `id` as their `profiles` row.
- `bio`, `category`, `tags`
- `live_join_fee` — how much fans pay per minute to join their live queue
- `is_live` — whether they're currently broadcasting
- `avg_rating`, `total_reviews`
- `stripe_connect_account_id` — their Stripe payout account

#### `call_packages`
Each creator defines their bookable offerings. A package = a duration + price.
- `creator_id`, `name`, `description`
- `duration` (minutes), `price` (dollars)
- `is_active` — can be hidden without deleting

#### `creator_availability`
Weekly recurring time blocks when a creator accepts bookings.
- `creator_id`, `day_of_week` (0=Sunday through 6=Saturday)
- `start_time`, `end_time`
- `package_id` — optionally restrict a slot to one package

#### `bookings`
The core 1-on-1 booking record.
- `creator_id`, `fan_id`, `package_id`
- `scheduled_at`, `duration`, `price`
- `status` — `upcoming`, `live`, `completed`, `cancelled`
- `stripe_payment_intent_id` — the Stripe payment reference
- `creator_present`, `fan_present` — set to true when each party actually joins the room
- `late_fee_amount`, `late_fee_paid_at`

#### `live_sessions`
Created when a creator starts a live broadcast.
- `creator_id`, `started_at`, `ended_at`, `is_active`
- `daily_room_url` — the Daily video room URL
- `join_fee` — fee per minute for fans
- `last_heartbeat_at` — updated every 15 seconds; stale after 45 seconds

#### `live_queue_entries`
One row per fan who has joined a live session queue.
- `session_id`, `fan_id`
- `status` — `waiting`, `active`, `completed`, `skipped`
- `stripe_pre_auth_id` — the authorized (not yet captured) payment
- `amount_pre_authorized` — the hold amount
- `amount_charged` — what was actually captured after the call ended
- `admitted_at` — when the creator let the fan in
- `duration_seconds` — actual call length

#### `reviews`
Post-call ratings, one per completed booking.
- `booking_id`, `creator_id`, `fan_id`
- `rating` (1–5), `comment`

#### `payouts`
Records of creator withdrawals.
- `creator_id`, `amount`, `status` (`processing`, `completed`, `failed`)
- `stripe_transfer_id` — the Stripe payout reference

#### `guest_contacts`, `guest_checkout_sessions`, `booking_access_tokens`
Legacy tables for the old guest checkout flow. Guest checkout is retired, but these tables remain for existing records. All three are service-only — no browser can read or write them directly.

### How Tables Relate to Each Other

```
profiles ──────────────────────────────────────────────┐
    │                                                   │
    ├── [if creator] ──> creator_profiles               │
    │                         │                         │
    │                    call_packages                  │
    │                    creator_availability           │
    │                                                   │
    ├── [as creator] ──> bookings <── [as fan] ─────────┘
    │                        │
    │                     reviews
    │
    ├── [as creator] ──> live_sessions
    │                         │
    │                    live_queue_entries ◄── [as fan]
    │
    └── [as creator] ──> payouts
```

### Which Parts of the App Read/Write Which Tables

| Table | Who reads | Who writes |
|---|---|---|
| `profiles` | Everyone (public) | User via settings; auth callbacks |
| `creator_profiles` | Everyone (public) | Creator via settings; server routes |
| `call_packages` | Everyone (public) | Creator via management pages |
| `bookings` | Creator + owning fan | Server routes only (not direct browser writes) |
| `live_sessions` | Everyone (public) | Creator's live endpoints |
| `live_queue_entries` | Session participants | `join-queue` route only |
| `reviews` | Everyone (public) | `reviews` route (after completed booking) |
| `payouts` | Owning creator only | `withdraw` route |

---

## 7. Major Flows, Step by Step

### Flow 1 — Fan Books a Creator

1. Fan visits `/book/alice` (Alice is a creator's username slug)
2. Browser calls `GET /api/public/creators/alice` — gets profile, packages, and availability
3. Fan picks a package, date, and time slot
4. Fan is prompted to sign in (guest checkout is retired)
5. Browser calls `POST /api/create-payment-intent` — server looks up the package price, creates a pending Stripe charge, returns a `clientSecret`
6. Fan enters card details into Stripe's UI (Stripe Elements — the card form is hosted by Stripe, not Friendsly)
7. Stripe confirms the payment and returns a `paymentIntentId` to the browser
8. Browser calls `POST /api/bookings` with the `paymentIntentId`
9. Server verifies: payment belongs to this fan, amount matches package price, payment succeeded in Stripe
10. Server creates the booking record in the database
11. Fan sees a success screen; booking appears in `/bookings`

**Key protection:** In step 9, the server re-fetches the package price from its own database and compares it to what Stripe actually charged. The fan cannot manipulate the amount.

---

### Flow 2 — Creator Goes Live

1. Creator clicks "Go Live" on their dashboard
2. Browser calls `POST /api/daily/room` — server creates a private video room on Daily.co, returns the room URL and an owner token
3. Creator joins the Daily room using that owner token (the owner role lets them control the call)
4. Server creates a `live_sessions` row with `is_active = true` and the Daily room URL
5. Server starts sending heartbeats every 15 seconds (`last_heartbeat_at` updated)
6. Creator's profile now shows `is_live = true` — visible to fans on the discovery page in real-time

---

### Flow 3 — Fan Joins a Live Queue

1. Fan visits `/waiting-room/[creatorId]`
2. Page fetches the active live session for that creator
3. Fan clicks "Join Queue" — sees the per-minute fee and confirms
4. Browser calls `POST /api/create-live-preauth` — server creates a Stripe PaymentIntent in **manual capture** mode
   - "Manual capture" means: the card is reserved (authorized) but not yet charged
   - The hold amount = join fee × 5 minutes (the maximum call length)
5. Fan confirms the payment hold (like putting down a deposit)
6. Browser calls `POST /api/live/join-queue` — server verifies the payment, creates a `live_queue_entries` row with status `waiting`
7. Fan sees their position in the queue with an estimated wait time
8. When the creator admits them, their queue entry status changes to `active`
9. Fan calls `POST /api/daily/token` to get a video room token (server checks they have an active queue entry first)
10. Fan joins the Daily room; their turn lasts up to 5 minutes
11. When the turn ends, server calls `finalize-charge`:
    - Fan was in for 2 minutes at $1/min → captures $2, releases the remaining $3 hold
    - Queue entry updated with `amount_charged` and `duration_seconds`

---

### Flow 4 — Creator Ends a Live Session

1. Creator clicks "End Live"
2. Browser calls `POST /api/end-live-session`
3. Server loops through all queue entries for this session:
   - `active` entries → calculates duration, captures exact amount, marks `completed`
   - `waiting` entries → refunds the full hold, marks `skipped`
4. Server marks `live_sessions.is_active = false`
5. Server updates `creator_profiles.is_live = false`
6. All fans in the waiting room see "Live has ended" — via Supabase Realtime pushing the change

---

### Flow 5 — Creator Receives a Payout

1. Creator visits `/earnings`
2. Page calls `GET /api/creator-payouts/status`
3. Server calculates:
   - **Total earnings** = 70% of completed booking charges + 70% of live queue charges
   - **Already withdrawn** = sum of completed `payouts` rows
   - **Available** = total earnings − already withdrawn − pending payouts
   - **Withdrawable** = min(available, Stripe's actual available platform balance)
4. Creator enters an amount and clicks "Withdraw"
5. Browser calls `POST /api/creator-payouts/withdraw`
6. Server verifies: amount ≤ withdrawable, no payout already in progress, Stripe Connect account is ready
7. Server calls Stripe to transfer money from Friendsly's Stripe account to the creator's connected bank
8. A `payouts` row is created with status `completed`

**The 70/30 split:** Creators keep 70% of the final charged amount. Friendsly keeps 30%. This is enforced through the shared revenue helpers.

---

### Flow 6 — Login and Auth

1. User enters email
2. Browser calls `POST /api/auth/prelogin-status` — checks if this email is blocked (e.g., rejected creator application)
3. If not blocked, user enters password
4. Supabase's auth SDK verifies the password and issues a JWT (a signed token proving identity)
5. The JWT is stored in a browser cookie
6. On every subsequent request, `middleware.ts` reads this cookie, confirms the session is valid, and refreshes it
7. API routes call `supabase.auth.getUser()` to confirm identity before doing anything sensitive

---

### Flow 7 — Creator Application Approval

1. Someone fills out the creator signup form at `/onboarding/creator-request`
2. Browser calls `POST /api/creator-signup-request`
3. Server saves a row in `creator_signup_requests` with status `pending`
4. Server calls a Supabase Edge Function `creator-signup-notify`, which sends an email via Resend to the admin
5. The email contains "Approve" and "Reject" links with a secure token
6. Admin clicks Approve → server updates the request status and the user's `profiles.role` to `"creator"`
7. The user can now log in and access creator features

---

## 8. External Services

### Supabase

**What it is:** A hosted database platform built on PostgreSQL. Also includes a built-in auth system, file storage, and real-time data subscriptions.

**Why Friendsly uses it:**
- **Database** — all app data lives here (users, bookings, live sessions, reviews, payouts)
- **Auth** — handles email/password login, OAuth (Google, Apple), password resets, and JWT issuance
- **Realtime** — powers the live queue updates without page refreshes
- **Storage** — stores uploaded avatar images in the `avatars` bucket

**What breaks if it goes down:** Everything. No data, no logins, no real-time updates.

**Key files:** `lib/supabase/server.ts`, `lib/supabase/client.ts`, every file in `app/api/`

**Two Supabase clients used in the codebase:**
- `createClient()` — uses the logged-in user's session (respects RLS, limited to what that user can see)
- `createServiceClient()` — uses the service-role key (bypasses RLS, sees everything). Used only on the server for verified operations.

---

### Stripe

**What it is:** A payment processing platform. Handles card charges, refunds, and payouts.

**Why Friendsly uses it:**
- **Fan payments** — booking and live queue fees go to Stripe first
- **Holds** — live queue payments are pre-authorized and captured only for actual duration used
- **Refunds** — cancellations and unused queue holds refunded through Stripe
- **Stripe Connect** — lets Friendsly route earnings to creators' bank accounts. Creators complete Stripe's onboarding to connect their bank.

**What breaks if it goes down:** Fans cannot pay. Creators cannot receive payouts. Bookings cannot be created.

**Key files:** `lib/server/stripe.ts`, `app/api/create-payment-intent/`, `app/api/create-live-preauth/`, `app/api/creator-payouts/`

**Important pattern — manual capture:**
For live queue payments, Stripe authorizes the card for the maximum possible amount (5 min × rate) but does not charge it yet. After the call ends, the server "captures" only what was actually used and releases the rest.

---

### Daily.co

**What it is:** A video API — it handles the actual video calls. Friendsly rents Daily's infrastructure rather than building its own.

**Why Friendsly uses it:**
- Creates private video rooms for 1-on-1 bookings
- Powers the live queue calls (creator stays in one room; fans join and leave one at a time)
- Issues "meeting tokens" that control who can join a room and with what permissions (owner vs. participant)

**What breaks if it goes down:** No one can start or join video calls.

**Key files:** `app/api/daily/room/route.ts`, `app/api/daily/token/route.ts`

**Room privacy:** Rooms are created with `privacy: "private"`. Only someone with a valid token can join — you cannot just guess the URL. Tokens are issued server-side only to authorized users (creator for owner token; admitted fans for participant tokens).

---

### Resend

**What it is:** An email sending service.

**Why Friendsly uses it:** Sends email notifications to the admin when a creator applies — the admin gets an email with Approve/Reject buttons.

**What breaks if it goes down:** Creator applications are still saved in the database, but the admin doesn't get an email. The app degrades gracefully — it notes whether email was delivered but still saves the request regardless.

**Key files:** `supabase/functions/creator-signup-notify/index.ts`

---

## 9. Security and Risk Basics

### Where Auth Happens
- Login is handled by Supabase (in `lib/hooks/useAuth.ts`)
- Session verification: every API route calls `supabase.auth.getUser()` first
- Page-level protection: `middleware.ts` redirects unauthenticated users before they can see protected pages

### Where Authorization Happens
- API routes manually check whether the logged-in user is allowed to perform each action
- Supabase RLS provides a second layer — even if application code has a bug, the database enforces its own rules

### The Most Sensitive Endpoints

| Endpoint | Why it's sensitive |
|---|---|
| `/api/create-payment-intent` | Creates real Stripe charges |
| `/api/bookings` | Creates paid reservations |
| `/api/live/finalize-charge` | Captures real money from fans |
| `/api/creator-payouts/withdraw` | Moves real money to creators' banks |
| `/api/daily/token` | Controls who enters a video room |
| `/api/stripe/webhook` | Receives Stripe events — must verify signature to prevent forgery |

### Environment Variables That Must Stay Secret

| Variable | What it does | Risk if leaked |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses all database security | Anyone can read/write all data |
| `STRIPE_SECRET_KEY` | Full Stripe account access | Anyone can charge cards or issue refunds |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook events are genuine | Anyone could forge payment events |
| `DAILY_API_KEY` | Create/delete video rooms | Anyone could create rooms at your expense |
| `RESEND_API_KEY` | Send emails | Anyone could send emails from your domain |

These live in `.env.local` locally and in Vercel's environment variable settings in production. They are never in the git repository.

---

## 10. How to Understand This App If You Come From Data Science / Business

### Think in Tables, Not Classes
You already understand that data lives in tables (like dataframes). The Supabase database is exactly that. The `bookings` table is one row per booking. The `live_queue_entries` table is one row per fan who joined a live session. Every feature in this app is ultimately reading from or writing to one of these tables.

### API Routes Are Like Stored Procedures
If you've written database stored procedures or dbt models that encapsulate logic, API routes are the same idea. `/api/bookings` is a piece of code that takes inputs, validates them, runs logic, writes to the database, and returns a result. The difference is it runs over HTTP instead of being called from SQL.

### Think of Auth as a Permissioned Query
When an API route calls `supabase.auth.getUser()`, it's asking: "Who made this request?" When it calls `requireCreatorUser()`, it's asking: "Does this user have `role = 'creator'` in the profiles table?" It's the same as a `WHERE user_id = ? AND role = 'creator'` guard before running any logic.

### Stripe Is Just a Payment Pipeline
Think of Stripe as an external data system you can both read from and write to. Creating a PaymentIntent is like writing a record to Stripe's system. Capturing it is like updating that record. The webhook is Stripe pushing updates back to you when something in their system changes.

### Realtime Is Like a Streaming DataFrame
Supabase Realtime is similar to a Kafka consumer or streaming data subscription. Instead of polling the database every second, you subscribe to a table and receive a push notification whenever a row is inserted, updated, or deleted. The waiting room uses this to update the queue without the fan refreshing.

### State Management Is Just In-Memory Variables
When you build a pandas pipeline, you hold DataFrames in memory as you transform them. A React component's "state" is the same idea — data held in memory that drives what the user sees. When state changes, the UI re-renders. It's transient (lost on refresh), just like in-memory variables.

### The 70/30 Take Rate
Creators earn 70% of the final charged amount. The platform retains 30%. For example, a $100 package charged at $102.50 results in $71.75 to the creator and $30.75 to the platform. This is enforced server-side, not in the UI.

---

## 11. Common Patterns in This Codebase

### Pattern 1 — Auth First, Then Logic
Every API route starts the same way:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401 Unauthorized;
```
Then checks role, then does the actual work. A route that skips this is either intentionally public or a bug.

### Pattern 2 — User Client for Auth, Service Client for Mutations
```typescript
const supabase = createClient();                // User's session — confirms identity
const serviceSupabase = createServiceClient();  // Service key — does privileged DB work
```
The user client confirms identity. The service client does the actual inserts and updates.

### Pattern 3 — Validate Everything from the Browser
Inputs from the browser are validated before being used:
```typescript
const packageId = stringField(body, "packageId", 80);
if (!isUuid(packageId)) return 400 Bad Request;
```
Helpers in `lib/server/request-security.ts`: `isUuid()`, `isPaymentIntentId()`, `isSafeMoneyCents()`, etc.

### Pattern 4 — Real-time via Supabase Channels
Any page that updates live subscribes to a Supabase channel:
```typescript
supabase.channel("live_queue")
  .on("postgres_changes", { event: "*", table: "live_queue_entries" }, callback)
  .subscribe();
```
When the DB changes, the callback fires and the page updates.

### Pattern 5 — Booking Window Math
Time-sensitive decisions use `getBookingWindow()` from `lib/bookings.ts`. All thresholds are named constants, not magic numbers:
- `BOOKING_EARLY_JOIN_MINUTES = 5` — fans can join 5 min before scheduled time
- `BOOKING_FAN_LATE_FEE_MINUTES = 5` — late fee starts 5 min after scheduled time
- `BOOKING_NO_SHOW_GRACE_MINUTES = 10` — auto-cancel if neither party shows after 10 min

### Pattern 6 — Manual Capture for Live Payments
Live queue joins use `capture_method: "manual"` in Stripe. The card is authorized at the maximum (5 min × rate). After the call ends, only the actual duration is captured and the rest is released.

### Pattern 7 — Graceful Degradation for Non-Critical Failures
If the email notification for a creator request fails, the app still saves the request and returns success:
```typescript
const emailResult = await notifyCreatorRequest(...); // may fail
return NextResponse.json({ ok: true, emailNotificationSent: emailResult.delivered });
```

### Pattern 8 — Heartbeat for Live Session Freshness
A live session updates `last_heartbeat_at` every 15 seconds. Any code checking "is this creator live?" first checks whether the heartbeat is within 45 seconds — otherwise the session is considered stale even if `is_active = true`.

---

## 12. Where to Look First When Debugging

| Symptom | Where to look |
|---|---|
| UI shows wrong data | The component file for that page — find the `fetch()` or `supabase.from()` call |
| Booking didn't get created | `app/api/bookings/route.ts` — walk through each validation step |
| Payment went through but no booking | The catch block in `app/api/bookings/route.ts` — the best-effort refund ran |
| A user can see data they shouldn't | The Supabase RLS policy for that table in `supabase/migrations/` |
| Creator's earnings are wrong | `lib/server/payouts.ts` → `getCreatorPayoutSummary()` |
| Live queue isn't updating in real-time | The Supabase Realtime subscription in `app/(fan)/waiting-room/[id]/page.tsx`, and check that Realtime is enabled for the table in the Supabase dashboard |
| Someone can't log in | `app/api/auth/prelogin-status/route.ts` (blocked?), then Supabase Auth logs, then `middleware.ts` |
| Daily room won't open | `app/api/daily/room/route.ts` (room creation) and `app/api/daily/token/route.ts` (token issuance) — verify `DAILY_API_KEY` is set |
| Payout failed | `app/api/creator-payouts/withdraw/route.ts` — check if Stripe Connect is fully set up |

---

## 13. How to Trace a Feature Through the Codebase

### Example: "How does the late fee work?"

**Step 1 — Find the UI trigger**
Search the components folder for "late fee." You'll find a UI prompt in the booking detail page when a fan is late to join.

**Step 2 — Find the API call**
Look for `fetch("/api/bookings/")` in that component. The late fee goes to `/api/bookings/[id]/late-fee`.

**Step 3 — Read the API route**
Open `app/api/bookings/[id]/late-fee/route.ts`. It has two modes:
- `mode = "create"` → makes a Stripe PaymentIntent for the fee
- `mode = "confirm"` → verifies the payment succeeded, then updates the booking record

**Step 4 — Find the business logic**
The route calls `getLateFeeAmountForPrice()` and `isLateFeeRequired()` from `lib/server/bookings.ts`. That file has the math (10% of booking price) and the timing conditions.

**Step 5 — Find the database effect**
After confirmation the route does:
```typescript
await serviceSupabase.from("bookings").update({ late_fee_amount, late_fee_paid_at })
```

**Step 6 — Follow the money downstream**
In `lib/server/payouts.ts`, `getCreatorPayoutSummary()` includes `late_fee_amount` in the creator's earnings. The late fee flows to the creator's payout calculation.

**Full trace: User action → Component → API route → Business logic → Database write → Payout calculation**

---

### The General Pattern to Follow Any Feature

```
User clicks something in the browser
         ↓
Component makes a fetch("/api/...") call
         ↓
app/api/.../route.ts receives it
         ↓
Auth check → Role check → Input validation
         ↓
Business logic (lib/server/bookings.ts, payouts.ts, stripe.ts)
         ↓
Database write (serviceSupabase.from("table").insert/update)
         ↓
Response sent back to browser as JSON
         ↓
Component updates its state
         ↓
UI re-renders with new data
```

---

## 14. If You Only Remember 10 Things

1. **Two products:** Scheduled 1-on-1 bookings (prepaid), and live queue (pay-per-minute, real-time).

2. **Two user roles:** Fans pay. Creators earn. Roles are stored in `profiles.role` and checked on every sensitive action.

3. **Everything financial goes through Stripe.** Card numbers never touch Friendsly's servers. Stripe handles the money; Friendsly records what happened.

4. **Live queue payments are pre-authorized, not pre-charged.** The hold is placed on the card but only the actual duration is captured after the call ends.

5. **API routes in `app/api/` are the backend.** They run on the server, use secret keys, and are never visible to the user. Every important action goes through one of these routes.

6. **Supabase is the database AND the auth system.** It handles logins, issues tokens (JWTs), stores all app data, and provides real-time subscriptions.

7. **Middleware is the bouncer.** `middleware.ts` runs before every page request and redirects users who aren't logged in or don't have the right role.

8. **Creators earn 70%, the platform keeps 30% of the final charged amount.** This is enforced server-side, not client-side.

9. **Guest checkout is retired.** All fans must have a Friendsly account to book. Old guest-checkout endpoints return 410 (Gone).

10. **Migrations tell the database's history.** Every schema change is in `supabase/migrations/` numbered in order (001 through 040). When debugging data issues, check whether the right migration has been applied.

---

## 15. Glossary

| Term | Plain English Definition |
|---|---|
| **API** | A set of rules for how two software systems talk to each other. Here, the browser talks to the server via HTTP API calls. |
| **Endpoint** | A specific URL the server responds to. `/api/bookings` is an endpoint. |
| **Route** | In Next.js, a file that becomes a URL. `app/api/bookings/route.ts` defines the `/api/bookings` endpoint. |
| **JWT** | JSON Web Token. A signed, encoded string that proves a user is logged in. Supabase issues one on login. |
| **RLS** | Row Level Security. A Postgres feature that restricts which rows each user can see, enforced at the database level — not just in application code. |
| **PaymentIntent** | A Stripe object representing a payment in progress. Tracks whether a charge has been authorized, captured, or refunded. |
| **Manual capture** | A Stripe mode where a card is authorized (reserved) but not charged until the server explicitly captures it. Used for live queue payments so fans are only charged for actual duration. |
| **Stripe Connect** | A Stripe feature for marketplaces. Lets Friendsly collect money from fans and route specific amounts to creators' bank accounts. |
| **Service role key** | A Supabase key that bypasses all RLS and has full database access. Must only be used on the server. Never in the browser. |
| **Webhook** | An automatic HTTP notification from an external service (like Stripe) to your server when something happens. |
| **Middleware** | Code that runs before every request — like a checkpoint. Here it checks auth and redirects unauthorized users. |
| **Component** | A reusable piece of UI in React. Like a custom HTML element that can hold logic and state. |
| **State** | Data held in a browser component's memory. Drives what the UI shows. Disappears on page refresh. |
| **Props** | Inputs passed into a component, like function arguments. |
| **Edge Function** | A small server-side function hosted by Supabase (not Vercel). Used here to send creator-request emails via Resend. |
| **Realtime subscription** | A persistent connection to the database that pushes updates when rows change. Used in the waiting room and live dashboard. |
| **Heartbeat** | A timestamp (`last_heartbeat_at`) updated every 15 seconds by an active live session to prove it's still running. Stale after 45 seconds. |
| **Environment variable** | A secret configuration value stored outside the code. Never committed to git. |
| **`createClient()`** | Creates a Supabase connection using the logged-in user's session (respects RLS). |
| **`createServiceClient()`** | Creates a Supabase connection using the service-role key (bypasses RLS). Server-only. |
| **Route group** | A folder in Next.js wrapped in parentheses like `(fan)`. Organizes files without affecting the URL. |
| **TOCTOU** | Time-of-check, time-of-use. A race condition where two simultaneous requests both pass a validation check before either completes the action. Mitigated here by a unique database constraint on `stripe_payment_intent_id`. |

---

## 16. Questions to Ask Next

### About the Business
- What is the target creator category for launch (fitness, entertainment, business)?
- Is the 70/30 revenue split final, or will it adjust by creator tier?
- What happens to the platform fee if a creator cancels — does Friendsly still keep the 2.5%?
- Is there a plan for creator verification beyond manual review?

### About the Product
- Is there a plan to add group calls or watch parties?
- Will creators be able to set their own late-fee percentage, or is 10% fixed?
- How does creator ranking on the discovery page work — is there a search ranking algorithm, or is it chronological?
- What is the refund policy if a creator never shows up repeatedly?

### About the Technical Architecture
- Where are booking room join tokens generated for 1-on-1 scheduled calls (as opposed to live queue calls)?
- What triggers the auto-cancel check for no-shows — is there a background job, or is it client-driven on each page load?
- Is there any admin dashboard for managing creator requests, or is it entirely email-driven?
- How does the Stripe Connect webhook get routed — is there a separate webhook endpoint for Connect events?

### About Operations
- Has the new Supabase project been created and all 40 migrations applied?
- Is `STRIPE_WEBHOOK_SECRET` configured in the production Vercel environment?
- Is there a monitoring plan (Sentry, Vercel logs) after launch?
- What is the incident response plan if a payment webhook fails silently in production?

### About Scale
- Are there database indexes on high-traffic query patterns (e.g., `bookings.creator_id`, `live_queue_entries.session_id`)?
- What happens if two creators go live at the same time and a fan tries to join both queues?
- At what user volume does the in-memory rate limiter need to be replaced with Redis?
