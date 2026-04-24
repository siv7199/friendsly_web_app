# Stripe Live Setup Checklist

Use this when switching Friendsly from Stripe test mode to real payments.

## 1. Stripe Live Keys

In Stripe, switch to Live mode and copy:

```txt
pk_live_...
sk_live_...
```

In Vercel, set:

```txt
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

Do not commit live keys to the repo or place them in `.env.local` unless intentionally testing live payments locally.

## 2. Stripe Webhook

In Stripe Live mode, create this webhook endpoint:

```txt
https://friendsly.app/api/stripe/webhook
```

Add this event at minimum:

```txt
account.updated
```

Copy the live webhook signing secret:

```txt
whsec_...
```

In Vercel, set:

```txt
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 3. Stripe Connect

Confirm these are complete in the live Stripe account:

- Express accounts enabled
- Transfers capability available
- Platform business verification complete
- Platform bank account added
- Stripe branding configured

## 4. Payout Request Email Function

Deploy the Supabase Edge Function:

```bash
supabase functions deploy payout-request-notify
```

Leave JWT verification on. Do not deploy with `--no-verify-jwt`.

Set these Supabase Edge Function secrets:

```txt
RESEND_API_KEY=your_resend_api_key
APP_BASE_URL=https://friendsly.app
PAYOUT_REQUEST_NOTIFICATION_EMAIL=your-admin-email@example.com
PAYOUT_REQUEST_FROM_EMAIL=Friendsly Payouts <support@send.friendsly.app>
```

`PAYOUT_REQUEST_NOTIFICATION_EMAIL` can include multiple admins:

```txt
sid@example.com,matvey@example.com
```

`PAYOUT_REQUEST_FROM_EMAIL` must be a Resend-verified sender/domain.

## 5. Database Migration

Run the payout request migration:

```txt
supabase/migrations/050_payout_request_reviews.sql
```

This adds payout review fields, allows the `rejected` payout status, creates review-token indexes, and removes direct browser inserts into `payouts`.

## 6. Redeploy

After saving Vercel environment variables, redeploy the app.

## 7. Live Smoke Test

Test with the smallest practical real payment:

1. Fan makes a booking payment.
2. Creator completes Stripe Connect onboarding.
3. Creator clicks Withdraw.
4. Payout request email arrives.
5. Admin opens the approve link.
6. Admin confirms approval.
7. Stripe transfer appears in the Stripe dashboard.
8. Creator payout history changes from `pending` to `completed`.

## Code Changes

No code changes should be needed just to switch Stripe accounts.

The app already reads Stripe config from:

```txt
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Vercel gets Stripe keys. Supabase gets email function secrets. Stripe gets the webhook URL.
