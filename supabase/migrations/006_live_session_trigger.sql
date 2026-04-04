-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: keep creator_profiles.is_live in sync with live_sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- Fires on INSERT and UPDATE of live_sessions.
-- Sets is_live = true when a session becomes active, false when it ends.
-- This means the fan-side Discover page reacts instantly via its existing
-- realtime subscription on creator_profiles — no polling needed.

CREATE OR REPLACE FUNCTION public.sync_creator_live_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.creator_profiles
    SET
      is_live                 = NEW.is_active,
      current_live_session_id = CASE WHEN NEW.is_active THEN NEW.id ELSE NULL END
    WHERE id = NEW.creator_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_live_session_change ON public.live_sessions;
CREATE TRIGGER on_live_session_change
  AFTER INSERT OR UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sync_creator_live_status();

-- ── Clean up any stale is_live flags ─────────────────────────────────────────
-- Reset any creator marked live who has no active session.
UPDATE public.creator_profiles
SET is_live = false, current_live_session_id = NULL
WHERE is_live = true
  AND id NOT IN (
    SELECT creator_id FROM public.live_sessions WHERE is_active = true
  );
