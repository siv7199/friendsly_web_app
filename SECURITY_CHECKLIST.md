# Friendsly Pre-Launch Checklist

This is the working plan for launch.

Order:

1. Basic functionality
2. Security hardening
3. Stress testing
4. Final deployment

Current status:

- Basic functionality: mostly done
- Security hardening: in progress
- Stress testing: after security
- Final deployment: tomorrow
- New Supabase project: required before final launch

## Phase 1: Basic Functionality

Status: completed enough to move forward, with a few UI fixes already handled.

### Verified

- [x] App deploy loads
- [x] Main flows load
- [x] Fan and creator sides load
- [x] Mobile UI issues found and patched
- [x] Public booking flow basically works

### Keep Watching

- [ ] Do one final smoke test after security fixes
- [ ] Recheck mobile layouts after final deployment

## Phase 2: Security Hardening

Status: start here now.

## 2.1 Immediate Secret Response

- [x] Treat the current exposed `SUPABASE_SERVICE_ROLE_KEY` as compromised
- [ ] Stop using the old Supabase project for final production
- [x] Remove any leaked service-role key values from files still in the repo/workspace
- [x] Make sure no server secret is in any `NEXT_PUBLIC_*` variable
- [x] Check for other leaked secrets in repo files and git history references

Definition of done:

- Old leaked key is no longer trusted
- New project will provide fresh keys
- No active production plan depends on the old leaked secret

## 2.2 New Supabase Project Cutover

- [ ] Create the new Supabase project
- [ ] Apply all migrations to the new project
- [ ] Recreate any required storage buckets
- [ ] Recreate any required auth/email/provider settings
- [ ] Recreate any required database extensions/settings
- [ ] Update local env vars to the new project
- [ ] Update hosting env vars to the new project
- [ ] Verify app connects to the new project successfully

Definition of done:

- Local app works against the new Supabase project
- Hosted app preview works against the new Supabase project
- No final deployment points at the old project

## 2.3 Environment Variables

Required runtime values:

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [x] `STRIPE_SECRET_KEY`
- [x] `DAILY_API_KEY`
- [x] `APP_BASE_URL`
- [ ] `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` if Supabase CAPTCHA is enabled

Environment hygiene:

- [x] `.env.local` stays out of git
- [ ] Production env values are not reused in local unnecessarily
- [ ] Preview and production are separated where possible
- [x] No secrets are hardcoded in source files
- [x] No secrets live in seed/test helper files

## 2.4 Supabase and Database Security

### Core checks

- [x] RLS enabled on all exposed tables
- [x] Policies reviewed table by table
- [x] Service-role key is only used on the server
- [x] Client-side code only uses anon/authenticated access where intended

### Tables to review

- [x] `profiles`
- [x] `creator_profiles`
- [x] `bookings`
- [x] `reviews`
- [x] `live_sessions`
- [x] `live_queue`
- [x] `call_packages`
- [x] creator availability tables
- [x] guest/public access tables if any still remain
- [x] payout-related tables if any exist

For each table:

- [x] Who can `select`
- [x] Who can `insert`
- [x] Who can `update`
- [x] Who can `delete`
- [x] `USING` and `WITH CHECK` logic is correct where needed
- [ ] One user cannot access another user's rows unless intended

Notes:

- Guest checkout/access tables are now explicitly service-only via migration `036`.
- Direct client booking inserts and updates are blocked; booking mutations now go through server routes via migration `037`.
- Direct live queue inserts and direct analytics inserts are blocked via migration `038`.
- Supabase linter warnings for mutable function search paths and broad avatar bucket listing are fixed via migration `039`.
- Public read policies remain intentional for creator discovery, packages, availability, reviews, live sessions, and live chat.

Definition of done:

- Every production table has explicit, reviewed access rules
- No sensitive table is relying on accidental openness

## 2.5 Auth and Authorization

- [x] Every high-risk write route checks authenticated user server-side
- [x] Every protected payment/booking/live route checks role/ownership server-side
- [x] Client-submitted role/user IDs are not trusted for creator/fan route authorization
- [x] Booking ownership is enforced on server
- [x] Creator-only actions are enforced on server
- [x] Review submission rules are enforced on server
- [x] Live room access rules are enforced on server
- [x] Legacy guest checkout mutation routes are retired
- [x] Logout/settings/profile access work correctly on both fan and creator sides
- [ ] Manual cross-account tampering tests pass

Definition of done:

- Users can only act on data and rooms they truly own or are allowed to access

Notes:

- Creator-only route checks now verify the database `profiles.role` plus creator profile existence.
- Fan-only claim checks now verify the database `profiles.role` instead of trusting user metadata.
- Old guest checkout/payment/booking endpoints now return a retired-flow response so booking requires a signed-in fan account.
- Token-only guest actions for cancel, presence, and late fee no longer mutate bookings without sign-in.

## 2.6 Stripe Security

- [x] Price is determined server-side
- [x] Client cannot override amount for bookings
- [x] PaymentIntent is verified server-side
- [x] Booking is created only after verified successful payment
- [x] Refund logic is server-enforced
- [x] Late-fee logic is server-enforced
- [ ] Stripe Connect is configured for creator payouts
- [ ] Stripe Connect onboarding flow works
- [x] Connected account status is validated server-side
- [x] Payout-related routes only work for eligible connected creators
- [ ] Stripe webhook secret is configured
- [x] Webhook signature verification is implemented
- [ ] Webhook handlers are idempotent
- [x] Live preauth amount is derived server-side
- [x] Live queue entry creation is now server-enforced

Definition of done:

- No payment-critical trust is placed on the browser

## 2.7 Daily / Video Security

- [x] Daily room/tokens are created server-side
- [x] Tokens include expiration for booking room creation
- [x] Tokens are scoped to the right room
- [x] Creator/fan room access is enforced by booking/live state for booking rooms
- [x] Generic Daily room/token routes now require auth and creator ownership checks
- [x] Live finalize/disconnect/end routes now require the real creator
- [ ] Users cannot join another room by changing IDs or tokens

Definition of done:

- Video access follows real authorization, not guessable URLs

## 2.8 Validation and Input Safety

- [x] Important request bodies are validated on the server
- [x] IDs, enums, timestamps, and money-related values are validated on high-risk routes
- [x] User-generated text is rendered safely
- [x] No user-controlled unsafe HTML rendering path exists
- [ ] Manual invalid-input testing passes

## 2.9 Rate Limiting and Abuse Protection

- [x] Sign in/pre-login endpoint limited
- [x] Creator sign-up request endpoint limited
- [x] Booking creation limited
- [x] Live join endpoints limited
- [x] Payment-related endpoints limited
- [x] Review submission limited
- [x] Avatar upload limited
- [x] Creator payout onboarding/withdraw routes limited
- [x] hCaptcha is wired into Supabase signup flows
- [ ] Any future email/OTP endpoints limited
- [ ] Replace in-memory limiter with shared production limiter if hosting runs multiple instances

Definition of done:

- Repeated abuse or spam attempts hit limits before harming the app

Notes:

- Added shared request-security helpers for safe JSON parsing, ID/date/payment validation, text length bounds, and basic rate limits.
- Current rate limits are in-memory process limits. They are useful immediately, but a shared limiter such as Redis/Upstash/Vercel KV is stronger for production scale.
- Unsafe HTML scan only found static Daily video style injection, not user-generated HTML rendering.

## 2.10 Headers and Browser Security

- [x] `Strict-Transport-Security`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Referrer-Policy`
- [x] `Permissions-Policy`
- [x] CSP added or planned carefully
- [x] CORS is not overly broad on sensitive endpoints
- [x] Source maps are not unintentionally exposed in production

Notes:

- Added global security headers in `next.config.mjs`.
- Disabled production browser source maps through Next config.
- CSP is intentionally planned, not enforced yet, because Stripe, Daily, Supabase storage, and inline Daily video styles need a careful allowlist to avoid breaking payments/video.

## 2.11 Logging and Recovery

- [x] Auth failures return explicit server-side errors
- [x] Payment failures return explicit server-side errors
- [x] Webhook failures logged
- [ ] High-risk admin/role changes logged
- [x] Secret rotation process written down
- [x] Rollback/recovery process written down

Notes:

- Added `docs/SECURITY_RUNBOOK.md` for secret rotation, rollback, webhook recovery, Supabase recovery, logging checks, and manual security smoke tests.
- Stripe webhook signature/config/processing failures now write server logs.
- There is no full admin dashboard yet, so high-risk admin/role-change logging stays open until those tools exist.

## Phase 3: Stress Testing

Status: do only after Phase 2 is complete enough.

### Booking and Live Concurrency

- [ ] Concurrent bookings for same slot tested
- [ ] Simultaneous live joins tested
- [ ] Creator live join/leave churn tested
- [ ] Reconnect behavior tested

### Payments and Background Flows

- [ ] Repeated payment attempts tested
- [ ] Duplicate webhook delivery tested
- [ ] Payment timeout/failure recovery tested

### Limits

- [ ] Rate limits actually trigger
- [ ] Abuse attempts are blocked
- [ ] Failed auth spam does not destabilize app

### Performance Under Load

- [ ] Key pages still work under moderate load
- [ ] Core APIs stay responsive under moderate load
- [ ] Realtime features stay usable under moderate load

## Phase 4: Final Deployment Tomorrow

Status: only after security and stress checks are complete enough.

### Before Deploy

- [ ] New Supabase project is live and connected
- [ ] Production env vars are correct
- [ ] Stripe production/test choice is intentional
- [ ] Stripe Connect is fully set up for production
- [ ] At least one creator completes Stripe Connect onboarding successfully
- [ ] Creator payout flow is smoke tested
- [ ] Daily production config is correct
- [ ] No temporary secrets remain
- [ ] No temporary bypasses remain in code

### Final Validation

- [ ] Fan sign up/sign in smoke test
- [ ] Creator flow smoke test
- [ ] Booking smoke test
- [ ] Payment smoke test
- [ ] Stripe Connect onboarding smoke test
- [ ] Creator payout status smoke test
- [ ] Live join smoke test
- [ ] Settings/profile/logout smoke test
- [ ] Mobile smoke test

### Launch Ready Means

- [ ] Basic functions work
- [ ] New Supabase project is in place
- [ ] Exposed secret is no longer relevant to production
- [ ] Core security items are complete
- [ ] Stress testing completed at a reasonable level
- [ ] Final smoke test passed

## Manual Security Tests

- [ ] Try changing booking IDs in requests
- [ ] Try changing live room IDs/tokens
- [ ] Try changing payment-related values in requests
- [ ] Try reading another user's data through client-available paths
- [ ] Try performing creator-only actions as a fan
- [ ] Try performing fan-only actions as another user
- [ ] Try replaying Stripe webhook requests without valid signature

## Suggested Working Order Tonight

1. Secret response and new Supabase project plan
2. Environment variable cleanup
3. Supabase RLS and policy review
4. Route-level auth/authorization review
5. Stripe, Stripe Connect, and Daily security review
6. Rate limiting and headers
7. Manual security tests
8. Stress testing
9. Final deploy prep for tomorrow
