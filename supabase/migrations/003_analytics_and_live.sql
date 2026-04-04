-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics & Live Tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add profile_views column
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;

-- 2. Create RPC function to securely increment profile views
CREATE OR REPLACE FUNCTION public.increment_profile_views(creator_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.creator_profiles
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE id = creator_uuid;
END;
$$;
