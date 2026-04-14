# Shareable Booking Link Engineering Spec

## 1. Purpose

This doc translates the shareable booking PRD into an implementation plan that fits the current Friendsly codebase.

It is based on the current product reality:
- auth is email + password
- fan signup already exists
- booking creation currently requires a signed-in user
- payment intent creation currently requires a signed-in user
- booking room join currently requires a signed-in user

The main engineering task is to add a public booking funnel that supports:
- existing signed-in fans
- new fans who create a standard Friendsly fan account
- guest fans who do not create an account

---

## 2. Current System Summary

### Existing auth entry point
- [app/page.tsx](/c:/Users/chint/Downloads/Friendsly_web_app/app/page.tsx)

Current behavior:
- sign in with email + password
- sign up with full name + email + password
- after signup, route to `/onboarding/role`

### Existing creator booking UI
- [components/fan/BookingModal.tsx](/c:/Users/chint/Downloads/Friendsly_web_app/components/fan/BookingModal.tsx)
- [app/(fan)/profile/[id]/page.tsx](/c:/Users/chint/Downloads/Friendsly_web_app/app/(fan)/profile/[id]/page.tsx)

Current behavior:
- fan opens creator profile
- booking happens in a modal
- payment intent is created only for authenticated users
- booking insert is allowed only for authenticated users

### Existing booking APIs
- [app/api/bookings/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/bookings/route.ts)
- [app/api/bookings/availability/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/bookings/availability/route.ts)
- [lib/server/bookings.ts](/c:/Users/chint/Downloads/Friendsly_web_app/lib/server/bookings.ts)
- [app/api/create-payment-intent/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/create-payment-intent/route.ts)

Current constraint:
- these flows assume `supabase.auth.getUser()` returns a real authenticated user

### Existing room join path
- [app/room/[id]/page.tsx](/c:/Users/chint/Downloads/Friendsly_web_app/app/room/[id]/page.tsx)
- [app/api/bookings/[id]/join/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/bookings/[id]/join/route.ts)

Current constraint:
- join access assumes a signed-in user

### Existing route protection
- [middleware.ts](/c:/Users/chint/Downloads/Friendsly_web_app/middleware.ts)

Current constraint:
- `/room` is protected
- creator profile pages already exist under `/profile/[id]`

---

## 3. Recommended V1 Architecture

Use a hybrid model:

### Public entry
Create a public booking route:
- `/book/[creatorSlug]`

This route should be accessible without auth.

### Identity paths after slot selection
After the fan selects a slot, provide 3 branches:
- existing account login
- create fan account with current signup flow
- continue as guest

### Payment model
Support two payment-intent creation modes:
- authenticated payment intent
- guest payment intent

### Booking ownership model
Every booking must end up attached to one of:
- `fan_id` for authenticated fans
- `guest_contact_id` for guest fans

### Guest access model
Guests should return later through a secure booking access token sent in confirmation/reminder links.

---

## 4. V1 Scope Decisions

### Keep as-is
- current fan signup fields
- current booking validation logic
- current creator availability model
- current booking conflict logic
- current Daily room creation and booking join core behavior

### Add
- public shareable booking page
- guest contact storage
- guest booking path
- guest payment-intent path
- guest booking confirmation and retrieval path
- guest room access path

### Defer
- OTP
- magic links
- Apple / Google auth
- deep account-merge automation
- advanced guest self-service account recovery

---

## 5. Route Plan

### New pages

#### `/book/[creatorSlug]`
Public creator booking landing page for shareable links.

Purpose:
- display creator and offer
- allow slot selection
- start booking flow without requiring auth up front

Suggested file:
- `app/book/[creatorSlug]/page.tsx`

#### `/book/[creatorSlug]/checkout`
Optional dedicated checkout page if we do not want modal-based public booking.

Purpose:
- summary
- identity decision
- guest form or login/create-account branch
- payment

Suggested file:
- `app/book/[creatorSlug]/checkout/page.tsx`

#### `/booking-access/[token]`
Guest booking access page.

Purpose:
- validate guest booking token
- show booking details
- allow join if window is open
- optionally allow limited actions like reschedule or cancel if approved for V1

Suggested file:
- `app/booking-access/[token]/page.tsx`

### Existing pages to update

#### `/`
Current auth page.

Recommended change:
- support redirect back into the shareable booking flow using `next`
- after sign in or sign up, route back to the pending booking path instead of always defaulting to onboarding/discover

#### `/room/[id]`
Keep current authenticated room path for full users.

Add a separate guest-safe path rather than weakening `/room/[id]` auth assumptions.

#### `/guest-room/[accessToken]`
Guest room entry path.

Purpose:
- validate token
- resolve booking
- call guest join API
- connect to Daily

Suggested file:
- `app/guest-room/[accessToken]/page.tsx`

---

## 6. API Plan

### Existing APIs to keep

#### `GET /api/bookings/availability`
Current endpoint is auth-gated and combines creator conflicts plus fan conflicts.

Do not reuse as-is for public booking.

#### `POST /api/bookings`
Keep for authenticated bookings.

#### `POST /api/create-payment-intent`
Keep for authenticated bookings.

### New APIs to add

#### `GET /api/public/creators/[creatorSlug]`
Returns public creator booking data.

Response should include:
- creator ID
- public profile data
- active call packages
- active booking availability
- booking interval

Purpose:
- power `/book/[creatorSlug]`

#### `GET /api/public/bookings/availability`
Returns bookable times for an unauthenticated visitor.

Inputs:
- `creatorId`
- optional `packageId`

Response:
- creator-booked windows
- package-compatible times

Important:
- do not include current fan conflict logic here because public visitors may not be logged in
- only block creator conflicts at this stage

#### `POST /api/public/guest-checkout/session`
Creates a temporary guest checkout session before payment.

Suggested request:
- `creatorId`
- `packageId`
- `scheduledAt`
- `topic`
- `guestName`
- `guestEmail`
- optional `guestPhone`

Suggested response:
- `guestCheckoutSessionId`
- normalized contact info
- summary data

Purpose:
- reserve enough context to continue to payment and booking creation

#### `POST /api/public/create-payment-intent`
Creates a Stripe PaymentIntent for guest checkout.

Suggested request:
- `guestCheckoutSessionId`

Suggested response:
- `clientSecret`
- `paymentIntentId`

Important:
- attach guest checkout metadata to Stripe instead of `userId`

Suggested metadata:
- `flowType=guest_booking`
- `creatorId`
- `packageId`
- `scheduledAt`
- `guestCheckoutSessionId`

#### `POST /api/public/bookings`
Creates the final guest booking after payment succeeds.

Suggested request:
- `guestCheckoutSessionId`
- `paymentIntentId`

Server responsibilities:
- validate payment status
- validate amount
- revalidate slot availability
- insert guest booking
- generate guest access token
- trigger confirmation delivery

#### `GET /api/public/booking-access/[token]`
Validates a guest access token and returns safe booking details.

Used by:
- `/booking-access/[token]`
- `/guest-room/[accessToken]`

#### `POST /api/public/bookings/[id]/claim`
Lets a guest claim a booking into a full account after signup/login.

Inputs:
- authenticated user session
- booking claim token or validated guest identity

Purpose:
- connect guest booking history to a real fan account

#### `POST /api/public/bookings/[id]/join`
Guest-safe join endpoint.

Inputs:
- guest access token

Behavior:
- resolve booking
- verify token validity
- verify join window
- create/reuse Daily room
- return room URL + meeting token

Do not reuse the authenticated join endpoint directly unless it is refactored to support both flows safely.

---

## 7. Data Model Plan

### Existing likely tables reused
- `profiles`
- `creator_profiles`
- `call_packages`
- `creator_availability`
- `bookings`

### Recommended new tables

#### `guest_contacts`
Stores the guest identity used for bookings.

Suggested fields:
- `id`
- `full_name`
- `email`
- `phone`
- `normalized_email`
- `normalized_phone`
- `created_at`
- `updated_at`

Purpose:
- avoid stuffing guest identity directly into every booking row
- enable multiple bookings by the same guest

#### `guest_checkout_sessions`
Stores in-progress guest booking context prior to final booking creation.

Suggested fields:
- `id`
- `creator_id`
- `package_id`
- `scheduled_at`
- `topic`
- `guest_contact_id`
- `status` (`pending`, `completed`, `expired`, `abandoned`)
- `payment_intent_id`
- `expires_at`
- `created_at`

Purpose:
- make payment creation and booking creation idempotent

#### `booking_access_tokens`
Stores secure guest access links.

Suggested fields:
- `id`
- `booking_id`
- `guest_contact_id`
- `token_hash`
- `purpose` (`manage`, `join`)
- `expires_at`
- `used_at`
- `revoked_at`
- `created_at`

Purpose:
- allow secure guest return without a password

### Existing table changes

#### `bookings`
Suggested additions:
- `guest_contact_id uuid null`
- `booking_owner_type text not null default 'fan'`
- `booking_access_state text null`

Suggested invariant:
- exactly one owner type per booking

V1 practical rule:
- authenticated booking => `fan_id` filled, `guest_contact_id` null
- guest booking => `guest_contact_id` filled, `fan_id` null until claimed

Optional useful additions:
- `guest_email_snapshot`
- `guest_name_snapshot`

These help preserve the purchase-time identity even if the guest contact changes later.

---

## 8. Security Model

### Guest access token rules
- store only hashed tokens in the database
- generate long random tokens
- include expiration
- allow token revocation

### Scope tokens by purpose
Separate token purposes:
- booking management view
- call join

This lowers blast radius if a link is shared.

### Join authorization
Guest join should require:
- valid token
- valid booking
- current time inside join window

### Sensitive actions
For V1, be conservative.

Recommended:
- allow guests to view booking
- allow guests to join call
- allow cancel only if business rules are straightforward
- defer reschedule unless product really needs it

---

## 9. Frontend Component Plan

### New component: `components/public/PublicBookingPage.tsx`
Purpose:
- creator hero
- package selection
- slot selection
- CTA to continue

### New component: `components/public/PublicBookingCheckout.tsx`
Purpose:
- summary
- identity choice
- guest form
- account creation branch
- payment form

### New component: `components/public/GuestBookingSuccess.tsx`
Purpose:
- confirmation
- “check your email” messaging
- direct booking access CTA if token already available

### Existing component refactor: `components/fan/BookingModal.tsx`
Recommended approach:
- extract reusable booking primitives instead of trying to make the modal serve every public flow directly

Suggested extractions:
- package picker
- slot picker
- booking summary
- payment step

This reduces duplication between:
- creator profile modal flow
- public shareable booking page flow

---

## 10. Auth Integration Plan

### Existing user login path
If the fan picks login:
- send them to `/` with `next` pointing to the pending booking checkout route
- after login, send them back to complete booking

### New fan signup path
If the fan picks create account:
- send them to `/?tab=signup&next=...`
- after signup and role selection, return them to the pending booking flow if role becomes `fan`

### Important current friction
Current signup routes users into `/onboarding/role`.

We need one of these approaches:

#### Option A. Keep role onboarding but preserve pending checkout
Implementation:
- store booking continuation state in query string or session storage
- after role selection as fan, resume booking

#### Option B. Add fan-only signup shortcut for shareable booking flow
Implementation:
- when signup begins inside shareable booking flow, create account as fan directly
- skip the general role picker

Recommended:
- Option B for this feature

Reason:
- lower friction
- avoids breaking checkout momentum
- avoids sending booking users into generic onboarding

---

## 11. Booking Validation Plan

### Reuse existing validation
Reuse from [lib/server/bookings.ts](/c:/Users/chint/Downloads/Friendsly_web_app/lib/server/bookings.ts):
- `validateBookingSelection`
- `findBookingConflicts`

### Required adjustment
Current conflict logic assumes `fanId` is always present.

For guest flows:
- creator conflict check still applies
- fan conflict check does not apply unless we later build guest conflict rules

Recommended implementation:
- split `findBookingConflicts` into reusable helpers:
  - creator-side conflicts
  - fan-side conflicts

This prevents guest flows from pretending a guest has an authenticated fan ID.

### Payment revalidation
Before creating the booking:
- re-run booking validation
- re-check slot conflicts
- verify payment amount
- verify payment intent has not already been used

---

## 12. Stripe Plan

### Existing authenticated flow
Current metadata includes:
- `userId`
- `creatorName`
- `packageName`

### Guest flow changes
Guest payment intents should use metadata such as:
- `flowType=guest_booking`
- `guestCheckoutSessionId`
- `creatorId`
- `packageId`
- `scheduledAt`

### Customer model
For V1 guest bookings:
- do not require a Stripe customer tied to a Friendsly user
- optional: create a guest Stripe customer only if needed for receipts or future ops

### Important idempotency rule
Booking creation must treat `paymentIntentId` as single-use across both authenticated and guest bookings.

---

## 13. Confirmation and Reminder Plan

### V1 delivery
At minimum send:
- confirmation email after booking
- reminder email before join window

Optional:
- SMS if infra already exists

### Email contents
Confirmation should include:
- creator name
- date/time/timezone
- booking details
- `Manage booking` link
- `Join call` instructions

Reminder should include:
- booking time
- `Join now` link

### Token generation
On successful guest booking:
- create one manage token
- create one join token or generate a join-scoped token later

---

## 14. Guest Claim Flow

### Goal
Allow a guest to convert a guest booking into a full Friendsly fan account later.

### Flow
1. Guest opens booking access page.
2. Guest chooses `Create account to save this booking`.
3. Guest completes standard fan signup.
4. Backend verifies contact identity match.
5. Booking is associated to the new `fan_id`.

### Recommended V1 behavior
When a guest claims:
- set `fan_id`
- keep `guest_contact_id` for historical traceability
- mark booking as claimed

Do not delete guest linkage immediately.

---

## 15. Middleware and Access Changes

### No change needed
- keep `/room` protected for authenticated users

### Needed additions
Public routes that must stay open:
- `/book/:creatorSlug`
- `/booking-access/:token`
- `/guest-room/:accessToken`

If added, make sure middleware does not accidentally redirect these routes to `/`.

---

## 16. Suggested Implementation Order

### Phase 1. Public read path
1. Add public creator booking page route.
2. Add public creator booking data API.
3. Add public availability API.

### Phase 2. Guest booking foundation
4. Add `guest_contacts` table.
5. Add `guest_checkout_sessions` table.
6. Add guest checkout session API.
7. Add guest payment-intent API.
8. Add guest booking creation API.

### Phase 3. Public checkout UI
9. Build public checkout UI with identity choice.
10. Wire guest form and payment flow.
11. Wire login and create-account redirect flow.

### Phase 4. Guest return access
12. Add `booking_access_tokens` table.
13. Add booking access validation API.
14. Build booking access page.
15. Send confirmation links.

### Phase 5. Guest join path
16. Add guest join endpoint.
17. Add guest room page.
18. Send reminder links.

### Phase 6. Claim flow
19. Add guest claim endpoint.
20. Add “claim this booking” UX.

---

## 17. Testing Plan

### Unit / server tests
Cover:
- booking validation for public flow
- guest checkout session creation
- guest booking creation idempotency
- payment-intent metadata validation
- access token validation and expiry

### Manual integration tests

#### Authenticated path
- existing fan books through shareable link
- booking appears in account
- join works from normal room flow

#### New-account path
- new fan signs up from shareable flow
- signup returns to booking
- payment succeeds
- booking attaches to account

#### Guest path
- guest books through shareable link
- email contains access link
- guest opens booking access page
- guest joins call through guest room path

#### Edge cases
- slot taken mid-checkout
- reused payment intent blocked
- expired access token rejected
- guest tries invalid token

---

## 18. Risks and Tradeoffs

### Risk: guest recovery is weak without OTP/magic links
Tradeoff:
- simpler V1
- more reliance on secure emailed links

Mitigation:
- add claim flow early
- make confirmation and reminder emails strong and clear

### Risk: signup continuation is clunky
Tradeoff:
- current auth flow is generic

Mitigation:
- add fan-only booking signup shortcut

### Risk: public availability and authenticated availability diverge
Mitigation:
- centralize booking validation in shared server helpers

### Risk: guest flow duplicates too much UI
Mitigation:
- extract reusable booking step components from `BookingModal`

---

## 19. Recommended Minimal V1 Build

If we want the smallest useful launch, build this subset:

1. `/book/[creatorSlug]`
2. public creator booking data API
3. public availability API
4. guest checkout session table + API
5. guest payment-intent API
6. guest booking creation API
7. secure emailed booking access link
8. `/booking-access/[token]`
9. existing-user login redirect back into checkout
10. simple account-creation redirect back into checkout

For the very first release, we could even defer:
- guest self-service reschedule
- guest self-service cancel
- guest claim flow

and still have a viable booking funnel.

---

## 20. One Practical Recommendation

Do not try to force the existing `BookingModal` to own the whole public shareable flow.

Instead:
- keep the current modal for signed-in in-app booking
- build a dedicated public booking page
- extract shared booking logic from the modal into reusable pieces

That will be easier to ship and easier to reason about.
