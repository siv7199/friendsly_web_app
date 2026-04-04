-- 012_realtime_and_chat_fix.sql
-- 1. Add session_id column to live_chat_messages (migration 007 may not have been applied)
ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.live_sessions(id);

-- 2. Enable REPLICA IDENTITY FULL so Supabase real-time row filters work correctly
--    (required for postgres_changes subscriptions with filters like fan_id=eq.X)
ALTER TABLE public.live_queue_entries REPLICA IDENTITY FULL;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_sessions REPLICA IDENTITY FULL;

-- 3. Add tables to the supabase_realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'live_queue_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_queue_entries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'live_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  END IF;
END $$;

-- 4. Deactivate any stale shell sessions (is_active=true but no daily_room_url)
--    These were created by the old init() flow and cause confusion on refresh.
UPDATE public.live_sessions
SET is_active = false
WHERE is_active = true AND daily_room_url IS NULL;
