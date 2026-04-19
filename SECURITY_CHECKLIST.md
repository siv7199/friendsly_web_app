# Friendsly Pre-Launch Checklist

This is the working plan for launch.

Order:

1. Basic functionality
2. Security hardening
3. Stress testing
4. Final deployment

Current status:

- Basic functionality: mostly done
- Security hardening: next
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

- [ ] Treat the current exposed `SUPABASE_SERVICE_ROLE_KEY` as compromised
- [ ] Stop using the old Supabase project for final production
- [ ] Remove any leaked service-role key values from files still in the repo/workspace
- [ ] Make sure no server secret is in any `NEXT_PUBLIC_*` variable
- [ ] Check for other leaked secrets in repo files and git history references

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

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `DAILY_API_KEY`
- [ ] `APP_BASE_URL`

Environment hygiene:

- [ ] `.env.local` stays out of git
- [ ] Production env values are not reused in local unnecessarily
- [ ] Preview and production are separated where possible
- [ ] No secrets are hardcoded in source files
- [ ] No secrets live in seed/test helper files

## 2.4 Supabase and Database Security

### Core checks

- [ ] RLS enabled on all exposed tables
- [ ] Policies reviewed table by table
- [ ] Service-role key is only used on the server
- [ ] Client-side code only uses anon/authenticated access where intended

### Tables to review

- [ ] `profiles`
- [ ] `creator_profiles`
- [ ] `bookings`
- [ ] `reviews`
- [ ] `live_sessions`
- [ ] `live_queue`
- [ ] `call_packages`
- [ ] creator availability tables
- [ ] guest/public access tables if any still remain
- [ ] payout-related tables if any exist

For each table:

- [ ] Who can `select`
- [ ] Who can `insert`
- [ ] Who can `update`
- [ ] Who can `delete`
- [ ] `USING` and `WITH CHECK` logic is correct where needed
- [ ] One user cannot access another user's rows unless intended

Definition of done:

- Every production table has explicit, reviewed access rules
- No sensitive table is relying on accidental openness

## 2.5 Auth and Authorization

- [ ] Every write route checks authenticated user server-side
- [ ] Every protected route checks role/ownership server-side
- [ ] Client-submitted role/user IDs are not trusted
- [ ] Booking ownership is enforced on server
- [ ] Creator-only actions are enforced on server
- [ ] Review submission rules are enforced on server
- [ ] Live room access rules are enforced on server
- [ ] Logout/settings/profile access work correctly on both fan and creator sides

Definition of done:

- Users can only act on data and rooms they truly own or are allowed to access

## 2.6 Stripe Security

- [ ] Price is determined server-side
- [ ] Client cannot override amount
- [ ] PaymentIntent is verified server-side
- [ ] Booking is created only after verified successful payment
- [ ] Refund logic is server-enforced
- [ ] Late-fee logic is server-enforced
- [ ] Stripe Connect is configured for creator payouts
- [ ] Stripe Connect onboarding flow works
- [ ] Connected account status is validated server-side
- [ ] Payout-related routes only work for eligible connected creators
- [ ] Stripe webhook secret is configured
- [ ] Webhook signature verification is implemented
- [ ] Webhook handlers are idempotent

Definition of done:

- No payment-critical trust is placed on the browser

## 2.7 Daily / Video Security

- [ ] Daily room/tokens are created server-side
- [ ] Tokens include expiration
- [ ] Tokens are scoped to the right room
- [ ] Creator/fan room access is enforced by booking/live state
- [ ] Users cannot join another room by changing IDs or tokens

Definition of done:

- Video access follows real authorization, not guessable URLs

## 2.8 Validation and Input Safety

- [ ] Important request bodies are validated on the server
- [ ] IDs, enums, timestamps, and money-related values are validated
- [ ] User-generated text is rendered safely
- [ ] No unsafe HTML rendering path exists

## 2.9 Rate Limiting and Abuse Protection

- [ ] Sign in endpoint limited
- [ ] Sign up endpoint limited
- [ ] Booking creation limited
- [ ] Live join endpoints limited
- [ ] Payment-related endpoints limited
- [ ] Review submission limited
- [ ] Any email/OTP endpoints limited

Definition of done:

- Repeated abuse or spam attempts hit limits before harming the app

## 2.10 Headers and Browser Security

- [ ] `Strict-Transport-Security`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy`
- [ ] `Permissions-Policy`
- [ ] CSP added or planned carefully
- [ ] CORS is not overly broad on sensitive endpoints
- [ ] Source maps are not unintentionally exposed in production

## 2.11 Logging and Recovery

- [ ] Auth failures logged
- [ ] Payment failures logged
- [ ] Webhook failures logged
- [ ] High-risk admin/role changes logged
- [ ] Secret rotation process written down
- [ ] Rollback/recovery process written down

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
