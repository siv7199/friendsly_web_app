CREATE TABLE IF NOT EXISTS public.creator_profile_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creator_profile_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_profile_view_events_select"
ON public.creator_profile_view_events
FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "creator_profile_view_events_insert"
ON public.creator_profile_view_events
FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS creator_profile_view_events_creator_viewed_idx
ON public.creator_profile_view_events (creator_id, viewed_at DESC);

CREATE OR REPLACE FUNCTION public.increment_profile_views(creator_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.creator_profile_view_events (creator_id, viewer_id)
  VALUES (creator_uuid, auth.uid());

  UPDATE public.creator_profiles
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE id = creator_uuid;
END;
$$;
