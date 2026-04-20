-- Live queue entries are now created through /api/live/join-queue so the
-- server can verify the PaymentIntent, amount, creator, and live session.
-- Direct client inserts would let a browser bypass those checks.

DROP POLICY IF EXISTS "lq_insert" ON public.live_queue_entries;

CREATE POLICY "lq_insert"
ON public.live_queue_entries
FOR INSERT
WITH CHECK (false);

-- Profile view analytics should be written through increment_profile_views().
-- Blocking direct inserts prevents simple client-side analytics spam.

DROP POLICY IF EXISTS "creator_profile_view_events_insert" ON public.creator_profile_view_events;

CREATE POLICY "creator_profile_view_events_insert"
ON public.creator_profile_view_events
FOR INSERT
WITH CHECK (false);
