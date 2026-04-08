ALTER TABLE public.live_sessions
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

UPDATE public.live_sessions
SET is_active = false,
    ended_at = COALESCE(ended_at, NOW())
WHERE is_active = true
  AND last_heartbeat_at IS NULL;
