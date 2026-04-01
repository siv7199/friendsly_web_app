-- ─────────────────────────────────────────────────────────────────────────────
-- Friendsly — Saved Creators table
-- ─────────────────────────────────────────────────────────────────────────────

-- Fans can "heart" / save creators to find them easily later.
CREATE TABLE IF NOT EXISTS public.saved_creators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fan_id, creator_id)
);

ALTER TABLE public.saved_creators ENABLE ROW LEVEL SECURITY;

-- Fan can read/write their own saved list; creators can see who saved them
CREATE POLICY "saved_select" ON public.saved_creators FOR SELECT
  USING (auth.uid() = fan_id OR auth.uid() = creator_id);
CREATE POLICY "saved_insert" ON public.saved_creators FOR INSERT
  WITH CHECK (auth.uid() = fan_id);
CREATE POLICY "saved_delete" ON public.saved_creators FOR DELETE
  USING (auth.uid() = fan_id);
