-- 009_fix_lq_rls.sql
-- Allow anyone to see the live queue list (so fans can see their position accurately).
-- Fans can still only INSERT their own entry.

DROP POLICY IF EXISTS "lq_select" ON public.live_queue_entries;
CREATE POLICY "lq_select" ON public.live_queue_entries FOR SELECT USING (true);

-- Ensure creators can always update their own session entries
DROP POLICY IF EXISTS "lq_update" ON public.live_queue_entries;
CREATE POLICY "lq_update" ON public.live_queue_entries FOR UPDATE 
USING (
  auth.uid() = fan_id OR 
  auth.uid() IN (SELECT creator_id FROM public.live_sessions WHERE id = session_id)
);
