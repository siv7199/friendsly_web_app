# Friendsly Final Testing And Security Checklist

This checklist replaces the earlier security-first plan.

Current goal:

- Finish final stress testing in the next few hours
- Run the remaining security review stack immediately after
- Complete the egress check
- Swap in the new Stripe keys and the new Supabase project values
- End today with a clean launch-readiness pass

Order for today:

1. Stress testing
2. Security review with three Claude skills
3. Egress check
4. Stripe key replacement
5. Supabase project/key replacement
6. Final smoke test

## Phase 1: Stress Testing

Status: start here now.

Focus only on these flows:

- Login
- Lives
- Individual bookings
- Payments and payouts
- Booking links

### 1.1 Login Stress Testing

- [x] Fan login works repeatedly without stale-session issues
- [x] Creator login works repeatedly without stale-session issues
- [x] Logout then immediate login works
- [x] Multi-tab login/logout behavior is stable
- [] Wrong-password and expired-session behavior is safe and recoverable
- [x] Auth rate limits or anti-abuse protections do not break normal usage

Definition of done:

- Login stays stable across repeated attempts and normal edge cases

### 1.2 Live Stress Testing

- [ ] Creator can start a live reliably more than once
- [ ] Fan live join flow works repeatedly
- [ ] Queue updates remain correct under repeated joins/leaves
- [ ] Admit flow still works under churn
- [ ] End-live cleanup completes without stale live state
- [ ] Reconnect behavior is acceptable for creator and fan
- [ ] No obvious duplicate charges or broken queue states appear during live testing

Definition of done:

- Live sessions remain usable under repeated joins, exits, admits, and reconnects

### 1.3 Individual Booking Stress Testing

- [ ] Booking creation works repeatedly for valid slots
- [ ] Already-taken slot protection still holds under repeat attempts
- [ ] Booking join window opens correctly
- [ ] Fan join flow works reliably
- [ ] Creator join flow works reliably
- [ ] Booking completion and cancellation states stay correct after repeated tests
- [ ] No duplicate booking rows or inconsistent booking states appear

Definition of done:

- Individual bookings stay consistent under repeated create, join, cancel, and complete flows

### 1.4 Payments And Payouts Stress Testing

- [ ] Booking payment flow succeeds repeatedly
- [ ] Live preauth and capture flow behaves correctly
- [ ] Failed payment path recovers cleanly
- [ ] Repeated submit/refresh behavior does not create duplicate charges
- [ ] Creator payout status page remains stable
- [ ] Stripe Connect onboarding still returns cleanly
- [ ] Withdrawal flow behaves correctly for an eligible creator
- [ ] Payout history and balances remain internally consistent after testing

Definition of done:

- Payment and payout flows remain correct, non-duplicative, and recoverable

### 1.5 Booking Link Stress Testing

- [ ] Public booking link opens correctly
- [ ] Valid booking access link still resolves to the intended booking
- [ ] Claimed/joined behavior stays correct
- [ ] Expired, invalid, or reused links fail safely
- [ ] Booking link flow does not expose another user's booking data

Definition of done:

- Booking links work for intended users and fail safely for invalid access

## Phase 2: Security Review

Status: start immediately after Phase 1.

### 2.1 Claude Skill Security Pass

- [ ] Run security check with Claude skill 1
- [ ] Run security check with Claude skill 2
- [ ] Run security check with Claude skill 3
- [ ] Consolidate findings into one short action list
- [ ] Patch any fast, high-confidence issues found today
- [ ] Defer lower-risk findings into follow-up tasks if they are not launch blockers

Definition of done:

- All three Claude security passes are complete and any launch-blocking findings are resolved or explicitly documented

### 2.2 Core Security Checks To Confirm

- [ ] Auth and role enforcement still hold on sensitive routes
- [ ] Booking ownership checks still hold
- [ ] Live room access still requires valid authorization
- [ ] Payment amount and payout eligibility remain server-enforced
- [ ] Booking-link access rules still hold
- [ ] No newly introduced secret exposure is present in source or logs

### 2.3 Manual Attack Checks

- [ ] Try changing booking IDs in requests
- [ ] Try changing live identifiers or join parameters
- [ ] Try changing payment-related values in requests
- [ ] Try creator-only payout/live actions from a fan account
- [ ] Try another-user booking-link access
- [ ] Try replaying Stripe webhook traffic without a valid signature

## Phase 3: Egress Check

Status: run after the Claude security pass.

- [ ] Confirm current app behavior does not reintroduce the old Supabase egress issue
- [ ] Watch auth, booking, live, and booking-link flows for suspicious repeated polling
- [ ] Watch realtime behavior for unnecessary churn
- [ ] Check that stress testing did not create obvious egress spikes
- [ ] Record whether current production path is acceptable or if the new Supabase project is still required immediately

Definition of done:

- We understand whether egress is under control and whether the new Supabase project cutover remains mandatory right now

## Phase 4: Key And Project Replacement

Status: do this after the egress check.

### 4.1 Stripe Keys

- [ ] Replace the original Stripe keys with the new Stripe keys locally
- [ ] Replace Stripe env vars in hosting
- [ ] Confirm `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is correct
- [ ] Confirm `STRIPE_SECRET_KEY` is correct
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` matches the active endpoint
- [ ] Redeploy after Stripe key changes

### 4.2 Supabase Project And Keys

- [ ] Replace the original Supabase project values with the new project values locally
- [ ] Replace Supabase env vars in hosting
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` is correct
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is correct
- [ ] Verify migrations, storage, auth settings, and functions are ready on the new project
- [ ] Redeploy after Supabase project/key changes

Definition of done:

- The app is pointed at the intended Stripe and Supabase production configuration with fresh values

## Phase 5: Final Smoke Test

Status: run after key replacement.

- [ ] Fan login smoke test
- [ ] Creator login smoke test
- [ ] Live smoke test
- [ ] Individual booking smoke test
- [ ] Booking payment smoke test
- [ ] Creator payout status smoke test
- [ ] Creator payout/withdraw smoke test
- [ ] Booking link smoke test
- [ ] Logs look clean enough for launch

## Launch Ready Means

- [ ] Stress testing is complete for login, lives, individual bookings, payments/payouts, and booking links
- [ ] Three Claude security checks are complete
- [ ] Egress check is complete
- [ ] New Stripe keys are live
- [ ] New Supabase project values are live
- [ ] Final smoke test passed

## Suggested Working Order Right Now

1. Login stress testing
2. Live stress testing
3. Individual booking stress testing
4. Payments and payouts stress testing
5. Booking link stress testing
6. Three Claude security checks
7. Manual attack checks
8. Egress check
9. Replace Stripe keys
10. Replace Supabase project values
11. Final smoke test
