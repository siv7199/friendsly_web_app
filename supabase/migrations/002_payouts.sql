-- ─────────────────────────────────────────────────────────────────────────────
-- Payouts Tracking table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status       TEXT DEFAULT 'pending' 
                 CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_select" ON public.payouts FOR SELECT 
  USING (auth.uid() = creator_id);
  
CREATE POLICY "payout_insert" ON public.payouts FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);
