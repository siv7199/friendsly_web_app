ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_cancellation_reason_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_cancellation_reason_check
      CHECK (
        cancellation_reason IS NULL OR cancellation_reason IN (
          'fan_cancelled_early',
          'fan_cancelled_late',
          'creator_cancelled',
          'auto_cancel_both_absent',
          'auto_cancel_creator_no_show',
          'auto_cancel_fan_no_show'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_id_unique_idx
ON public.reviews (booking_id)
WHERE booking_id IS NOT NULL;

DELETE FROM public.reviews;

DROP POLICY IF EXISTS "book_insert" ON public.bookings;
CREATE POLICY "book_insert" ON public.bookings FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "rev_insert" ON public.reviews;
CREATE POLICY "rev_insert" ON public.reviews FOR INSERT
  WITH CHECK (false);
