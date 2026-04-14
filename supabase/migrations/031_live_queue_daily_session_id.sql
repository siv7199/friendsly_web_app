ALTER TABLE public.live_queue_entries
ADD COLUMN IF NOT EXISTS admitted_daily_session_id TEXT;
