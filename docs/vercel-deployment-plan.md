# Friendsly Vercel Deployment Plan

This document is a simple planning guide for deploying Friendsly to Vercel later, after the product code is finished.

## Current assumptions

- Vercel is not connected yet. This will be a first-time setup.
- There is only one Supabase project right now.
- A new Supabase project will likely be created before production because the current project has egress issues.
- We are not making final decisions yet about preview deployments or the final environment variable list.

## What Vercel is

Vercel is where the Next.js app will be hosted.

For this project, Vercel would deploy the frontend app and server routes in:

- `app/`
- `components/`
- `lib/`
- `middleware.ts`
- `package.json`
- `next.config.mjs`

Vercel does not automatically recreate or manage the database itself. Supabase still needs its own setup and migrations.

## What needs to exist before deployment

Before deploying to Vercel, these pieces should be ready:

1. A GitHub repo with the final code pushed.
2. A production Supabase project.
3. Production environment variables.
4. A decision on the production domain.
5. A short post-deploy smoke test checklist.

## Recommended project structure

The current repo structure is already mostly fine for Vercel.

Important app files:

- `app/`
- `components/`
- `lib/`
- `types/`
- `public/` if added later
- `package.json`
- `package-lock.json`
- `next.config.mjs`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `tsconfig.json`

Important Supabase files:

- `supabase/migrations/`

Important deployment/checklist files:

- `PRE_DEPLOY_TEST_CHECKLIST.md`
- this file: `docs/vercel-deployment-plan.md`

## How deployment would work later

When the code is ready, the normal flow would be:

1. Push the final code to GitHub.
2. Create a new project in Vercel.
3. Import the GitHub repo into Vercel.
4. Add all required environment variables in Vercel.
5. Point the app at the new production Supabase project.
6. Run the Supabase migrations on the production database.
7. Deploy.
8. Test auth, bookings, live rooms, guest links, refunds, and realtime behavior.

## Supabase preparation

Because the current Supabase project is likely temporary, the production launch should use a fresh Supabase project.

Before production, make sure to:

1. Create the new Supabase project.
2. Add the correct auth settings.
3. Add any storage buckets needed.
4. Run all migrations from `supabase/migrations/`.
5. Verify Realtime is enabled for the tables the app depends on.

Important recent migrations to remember:

- `033_creator_profiles_realtime.sql`
- `034_bookings_realtime.sql`

## Environment variables

We have not finalized the exact production env var list yet.

Later, this should be split into:

- Public variables:
  Values safe to expose to the browser, usually `NEXT_PUBLIC_*`
- Server-only variables:
  Secrets that should only exist on the server

Likely categories:

- Supabase
- Daily
- Stripe
- any email / notification providers

Before production, make a final env var checklist and confirm:

1. Which vars are required locally
2. Which vars are required in Vercel
3. Which vars are safe to expose publicly
4. Which vars must stay server-only

## A note on preview deployments

This was one of the unclear questions earlier, so here is the simple version:

- `main only` means only the main branch is treated as the real deploy target.
- `preview deployments` means Vercel can also create temporary test deployments for pull requests or other branches.

We do not need to decide this right now.

Safe default later:

- use `main` for production
- optionally enable preview deployments when the app becomes more stable

## Recommended deployment checklist

Before deployment:

1. Make sure the app builds cleanly.
2. Make sure the final booking, live, and guest flows work.
3. Make sure production env vars are ready.
4. Make sure the new Supabase project is ready.
5. Make sure migrations are applied.

After deployment:

1. Test sign in / sign up.
2. Test creator dashboard.
3. Test fan bookings.
4. Test guest/shareable booking links.
5. Test live session status updates.
6. Test booking room join.
7. Test late fee flow.
8. Test auto-cancel and refund behavior.

## Things still to decide later

These are not blockers for writing this plan, but they need real answers before launch:

1. Final production domain
2. Final production Supabase project
3. Final environment variable list
4. Whether preview deployments should be enabled
5. Whether migrations will be run manually or through a deployment workflow

## Suggested next document later

Once the codebase is closer to launch, create one follow-up document with:

- exact environment variable names
- exact Vercel setup steps
- exact Supabase setup steps
- exact launch checklist

Suggested filename:

- `docs/vercel-production-checklist.md`
