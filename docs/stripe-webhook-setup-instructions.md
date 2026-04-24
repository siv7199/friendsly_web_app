# Stripe Webhook Setup Instructions

Use these steps when Stripe is already in Live mode.

## What This Webhook Is For

Friendsly uses this webhook to keep creator Stripe Connect status in sync after creators complete or update onboarding.

The app endpoint is:

```txt
https://friendsly.app/api/stripe/webhook
```

The app currently needs this event:

```txt
account.updated
```

This should be a connected-account webhook, because the app is listening for updates from creator Stripe Express accounts.

## Create The Webhook In Stripe

1. Open the Stripe Dashboard.

2. In the left sidebar, click **Developers** or **Workbench**.

3. Click **Webhooks**.

4. Click **Create an event destination** or **Create new destination**.

5. When Stripe asks what events to listen for, choose:

```txt
Connected accounts
```

Do not choose only "Your account" for this webhook.

6. Select the event type:

```txt
account.updated
```

7. Continue to the destination setup screen.

8. For destination type, choose:

```txt
Webhook endpoint
```

9. Paste this endpoint URL:

```txt
https://friendsly.app/api/stripe/webhook
```

10. Optional description:

```txt
Friendsly Connect account status updates
```

11. Click **Create destination**, **Add endpoint**, or **Save**.

## Add The Signing Secret To Vercel

1. Open the webhook destination you just created.

2. Find **Signing secret**.

3. Click **Reveal**.

4. Copy the value. It starts with:

```txt
whsec_
```

5. In Vercel, open the Friendsly project.

6. Go to **Settings** → **Environment Variables**.

7. Add or update:

```txt
STRIPE_WEBHOOK_SECRET=whsec_...
```

8. Save it for Production.

9. Redeploy the app.

## Confirm It Works

1. Have a creator start or finish Stripe Connect onboarding.

2. In Stripe, go to **Developers/Workbench** → **Webhooks**.

3. Open the Friendsly webhook destination.

4. Check recent deliveries.

5. A successful delivery should show a `2xx` response.

## Important Notes

- Use the signing secret from this exact live webhook destination.
- The webhook should listen to **Connected accounts**.
- The only required event right now is `account.updated`.
- The endpoint URL must be exactly:

```txt
https://friendsly.app/api/stripe/webhook
```
