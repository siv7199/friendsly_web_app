-- Migration 009 left `live_queue_entries` SELECT as USING (true), which
-- means the anon role (any unauthenticated client with the publishable
-- Supabase URL) can read every queue row — including amount_pre_authorized,
-- amount_charged, and stripe_pre_auth_id.
--
-- The waiting-room UI needs to show the queue to authenticated fans so they
-- can see their position, and the creator dashboard aggregates amounts, so
-- we cannot narrow this to per-user without replacing those queries. We can,
-- however, cut off unauthenticated scrapers with zero UI impact by limiting
-- the policy to the `authenticated` role.

DROP POLICY IF EXISTS "lq_select" ON public.live_queue_entries;

CREATE POLICY "lq_select"
  ON public.live_queue_entries
  FOR SELECT
  TO authenticated
  USING (true);
