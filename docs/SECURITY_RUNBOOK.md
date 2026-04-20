# Friendsly Security Runbook

Use this during launch, incident response, and recovery.

## Secret Rotation

Rotate secrets immediately if they are pasted into chat, committed, shown in screenshots, or exposed in logs.

1. Revoke or rotate the exposed secret in the provider dashboard.
2. Update local `.env.local` only if local testing needs the new value.
3. Update hosting environment variables for preview and production.
4. Redeploy the app so server routes use the new value.
5. Confirm the old value no longer works.
6. Record what changed and when.

High-risk secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DAILY_API_KEY`
- `RESEND_API_KEY`

Public keys such as `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may be visible in the browser, but they still need correct database policies and domain/provider settings.

## Rollback

Use rollback when a deployment breaks sign-in, booking, payment, live calls, or creator payouts.

1. Pause risky testing or public traffic if needed.
2. Revert to the last known-good deployment in the hosting dashboard.
3. Do not roll back database migrations unless the rollback SQL is known safe.
4. Verify sign-in, booking, payment, live join, and creator dashboard smoke tests.
5. Keep the bad deployment available for debugging, but do not route users to it.

## Logging Checks

Before launch, verify server logs are visible in the hosting provider for:

- Auth and role failures
- Booking/payment creation failures
- Stripe webhook signature or processing failures
- Daily room/token failures
- Creator request notification failures
- Avatar upload/storage failures

Do not log full secrets, access tokens, card data, raw authorization headers, or full Stripe webhook payloads.

## Stripe Webhook Recovery

1. If webhooks fail, confirm `STRIPE_WEBHOOK_SECRET` matches the active Stripe endpoint.
2. Re-send failed events from the Stripe dashboard.
3. For `account.updated`, re-opening the creator payout status page can also resync Connect state from Stripe.
4. Treat duplicate webhook delivery as normal; handlers should be safe to run more than once.

## Supabase Recovery

1. Keep the old Supabase project out of final production because its service-role key was exposed.
2. Use the new Supabase project for final launch after migrations, storage, auth settings, and Edge Functions are recreated.
3. If a migration fails midway, stop and inspect the exact error before rerunning later migrations.
4. Confirm RLS policies after security migrations `036`, `037`, and `038`.

## Manual Security Smoke Tests

Run these before final deploy:

- Try changing booking IDs as another fan.
- Try creator-only payout/live routes from a fan account.
- Try joining a Daily room by changing IDs.
- Try changing payment amounts or PaymentIntent IDs.
- Try replaying a Stripe webhook without a valid signature.
- Try repeated booking/payment/review requests until rate limits trigger.
