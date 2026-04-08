ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS scheduled_live_at TIMESTAMPTZ;

ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS scheduled_live_timezone TEXT;
