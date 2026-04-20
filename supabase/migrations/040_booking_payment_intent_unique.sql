-- Prevent two bookings from being created against the same Stripe PaymentIntent.
-- A TOCTOU window exists between the duplicate-check read and the insert in the
-- booking creation route; a unique partial index makes the constraint atomic.
-- Partial (WHERE NOT NULL) so rows with no PI (manual/admin bookings) are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_payment_intent_unique
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
