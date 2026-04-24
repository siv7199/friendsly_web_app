ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS review_token UUID DEFAULT gen_random_uuid();

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.payouts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payouts DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.payouts
ADD CONSTRAINT payouts_status_check
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_payouts_review_token
  ON public.payouts (review_token)
  WHERE review_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_creator_status
  ON public.payouts (creator_id, status);

UPDATE public.payouts
SET review_token = NULL
WHERE status <> 'pending';

DROP POLICY IF EXISTS "payout_insert" ON public.payouts;
