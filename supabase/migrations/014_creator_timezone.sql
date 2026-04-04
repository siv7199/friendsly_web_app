ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
