ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS booking_interval_minutes INTEGER NOT NULL DEFAULT 30
CHECK (booking_interval_minutes IN (15, 30, 60));
