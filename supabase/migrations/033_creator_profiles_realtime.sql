-- Ensure fan live-status screens receive creator live flag changes.
-- The live session trigger updates creator_profiles.is_live/current_live_session_id,
-- so creator_profiles must be part of Supabase Realtime too.

ALTER TABLE public.creator_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'creator_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_profiles;
  END IF;
END $$;
