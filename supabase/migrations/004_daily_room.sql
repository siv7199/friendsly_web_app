-- ─────────────────────────────────────────────────────────────────────────────
-- Daily.co Room URL Tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add daily_room_url to live_sessions
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS daily_room_url TEXT;

-- 2. Add daily_room_url to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS daily_room_url TEXT;
