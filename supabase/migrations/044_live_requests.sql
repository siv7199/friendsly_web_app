CREATE TABLE IF NOT EXISTS public.live_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_requests_creator_fan_date_unique UNIQUE (creator_id, fan_id, request_date),
  CONSTRAINT live_requests_creator_fan_diff CHECK (creator_id <> fan_id)
);

CREATE INDEX IF NOT EXISTS live_requests_creator_date_requested_idx
  ON public.live_requests (creator_id, request_date, requested_at DESC);

CREATE INDEX IF NOT EXISTS live_requests_fan_date_idx
  ON public.live_requests (fan_id, request_date DESC);

ALTER TABLE public.live_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_requests'
      AND policyname = 'live_requests_no_direct_access'
  ) THEN
    EXECUTE 'DROP POLICY "live_requests_no_direct_access" ON public.live_requests';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "live_requests_no_direct_access"
    ON public.live_requests
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false)
  $policy$;
END $$;
