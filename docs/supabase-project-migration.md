# Supabase Project Migration Runbook

This document captures the safest migration path for moving Friendsly to a new Supabase project if production egress or project state requires a cutover.

It is written for this repo and its current integrations:

- Next.js 14 App Router
- Supabase Auth, Postgres, Realtime, Storage
- Stripe / Stripe Connect
- Daily.co

## Goal

Move Friendsly to a new Supabase project with the smallest possible risk to:

- frontend and UI
- bookings
- guest booking flows
- live queue flows
- Daily live/session behavior
- auth
- payouts / Stripe flows
- creator dashboards
- mobile behavior

## Recommended Migration Method

When backups are available, prefer Supabase Dashboard:

- `Database -> Backups -> Restore to a New Project`

This is the safest default because it creates a database-level clone of the existing project.

Current Supabase docs:

- https://supabase.com/docs/guides/platform/clone-project
- https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## What Restore To A New Project Transfers

Per current Supabase docs, this generally transfers:

- database schema
- tables, views, procedures
- data and indexes
- database roles, permissions, users
- auth user data in the database

## What Must Be Recreated Or Rechecked Manually

These do not fully come over automatically and must be checked before cutover:

- Edge Functions
- Auth settings
- API keys
- Realtime settings
- Storage buckets and storage objects
- database extensions and some database settings
- read replicas, if any

For this repo, also explicitly verify:

- Supabase auth redirect URLs
- email templates / auth provider configuration
- storage bucket config for avatars
- any RLS-sensitive flows that depend on auth/session cookies

## Repo-Specific Files And Env Vars

Supabase clients:

- [lib/supabase/client.ts](/c:/Users/chint/Downloads/Friendsly_web_app/lib/supabase/client.ts:1)
- [lib/supabase/server.ts](/c:/Users/chint/Downloads/Friendsly_web_app/lib/supabase/server.ts:1)
- [middleware.ts](/c:/Users/chint/Downloads/Friendsly_web_app/middleware.ts:1)

Important env vars to update at cutover:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Also verify related non-Supabase env vars still point at the correct production stack:

- `DAILY_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `APP_BASE_URL` or `NEXT_PUBLIC_SITE_URL`

## Storage Migration Notes

Friendsly serves avatar images from Supabase Storage via:

- [app/api/public/avatar/[userId]/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/public/avatar/[userId]/route.ts:1)
- [app/api/profile/avatar/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/profile/avatar/route.ts:1)

Important:

- database restore does not move storage objects
- avatar bucket contents must be migrated separately
- bucket config and policies must be recreated or verified in the new project

If storage objects are not moved before cutover, profile avatars will break.

## Edge Functions

Current function directory:

- [supabase/functions/creator-signup-notify/index.ts](/c:/Users/chint/Downloads/Friendsly_web_app/supabase/functions/creator-signup-notify/index.ts:1)

Before cutover:

- confirm all functions needed in production exist in `supabase/functions`
- deploy them to the new project
- re-add any function secrets/config

## Migration Steps

### 1. Prepare A Safe Window

- choose a low-traffic deployment window
- avoid cutting over during an active creator live session
- avoid cutting over during payout or refund handling if possible

### 2. Create The New Supabase Project

- create via `Restore to a New Project` from the source project backup
- choose the correct source backup or PITR point
- wait for restore completion

### 3. Recreate Manual Project Config

In the new project dashboard:

- configure auth settings
- configure auth redirect URLs
- configure any OAuth providers
- recheck Realtime settings
- re-enable required extensions/settings if needed
- recreate storage buckets
- migrate storage objects
- deploy Edge Functions

### 4. Set New Project Secrets

Collect the new values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Update them in the deployment environment used by Friendsly.

### 5. Review Supabase-Dependent Product Areas Before Traffic Cutover

Validate these flows against the new project in a staging or preview deployment first:

- sign up
- sign in
- sign out
- auth callback
- creator approval/review flow
- discover page
- creator profile page
- saved creators
- bookings list
- creator dashboard
- creator calendar
- creator management
- live console
- waiting room
- room join flow
- guest checkout session creation
- public booking creation
- booking access token claim/join/cancel/presence/late-fee flows
- avatar upload and avatar display

### 6. Stripe And Payment Validation

Supabase migration does not replace Stripe configuration work. Validate:

- customer lookup still works
- setup intents still work
- booking payment intent creation still works
- live preauth still works
- live finalize charge still works
- creator payout onboarding still works
- creator withdrawal/status/dashboard routes still work

Relevant routes include:

- [app/api/create-payment-intent/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/create-payment-intent/route.ts:1)
- [app/api/public/create-payment-intent/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/public/create-payment-intent/route.ts:1)
- [app/api/create-live-preauth/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/create-live-preauth/route.ts:1)
- [app/api/live/finalize-charge/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/live/finalize-charge/route.ts:1)
- [app/api/creator-payouts/onboarding/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/creator-payouts/onboarding/route.ts:1)
- [app/api/creator-payouts/withdraw/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/creator-payouts/withdraw/route.ts:1)

### 7. Daily.co Validation

Validate:

- room creation
- creator owner token creation
- booking join token creation
- live session connect/disconnect

Relevant routes:

- [app/api/daily/room/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/daily/room/route.ts:1)
- [app/api/daily/token/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/daily/token/route.ts:1)
- [app/api/bookings/[id]/join/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/bookings/[id]/join/route.ts:1)
- [app/api/live/disconnect/route.ts](/c:/Users/chint/Downloads/Friendsly_web_app/app/api/live/disconnect/route.ts:1)

### 8. Deploy With New Env Vars

- deploy the app with the new Supabase env vars
- verify the deployment is healthy
- verify middleware-authenticated pages load successfully

### 9. Perform Post-Deploy Smoke Test

Run this smoke test immediately after deployment:

- fan sign in
- creator sign in
- discover loads
- creator profile loads
- booking creation works
- same-day block still enforced
- double-booking still blocked
- join window opens 5 minutes early
- live queue join works
- Daily room join works
- guest booking link works
- guest booking token claim works
- creator dashboard stats load
- payouts dashboard loads
- avatar loads

### 10. Monitor After Cutover

Watch for:

- auth/session failures
- avatar/storage 404s
- booking creation errors
- guest booking token failures
- live queue failures
- payout route errors
- unusual PostgREST egress or Realtime spikes

## Downtime Strategy

Safest approach for this app:

- do a clean env-var cutover in one deployment window
- do not try to run old and new Supabase projects in parallel for production traffic

Why:

- auth cookies and project keys are project-specific
- storage and realtime state are project-specific
- guest token and booking flows are tightly coupled to one backend state source

## User Session Expectations

Expect some users to need to sign in again after cutover.

Even if auth records restore correctly, the app will be pointing at a new Supabase project with new keys and sessions.

## Rollback Plan

If validation fails after cutover:

1. revert deployment env vars to the old Supabase project
2. redeploy immediately
3. pause further writes to the new project until issue is understood
4. investigate whether the issue is:
   - missing auth config
   - missing storage objects
   - missing Edge Function deploy
   - missing Realtime setting
   - wrong redirect URL / site URL

## Known Repo Cautions

- [seed-bookings.js](/c:/Users/chint/Downloads/Friendsly_web_app/seed-bookings.js:1) contains hardcoded Supabase credentials for the old project and should not be used against a new project without updating it.
- If any custom changes were made in `auth` or `storage` schemas outside standard migrations, diff and restore them explicitly.
- If the source project has extensions that perform external work, Supabase recommends disabling or reviewing them after clone to avoid accidental actions in the new project.

## Quick Checklist

- new project restored from backup
- auth settings recreated
- API keys updated
- redirect URLs updated
- Realtime settings checked
- storage buckets recreated
- storage objects migrated
- Edge Functions deployed
- env vars updated
- auth smoke test passed
- booking smoke test passed
- guest flow smoke test passed
- live flow smoke test passed
- payout smoke test passed
- egress monitored after launch
