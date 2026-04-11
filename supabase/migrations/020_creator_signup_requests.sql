CREATE TABLE IF NOT EXISTS public.creator_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  social_link TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_creator_signup_requests_email
  ON public.creator_signup_requests (lower(email));

CREATE INDEX IF NOT EXISTS idx_creator_signup_requests_status_created_at
  ON public.creator_signup_requests (status, created_at DESC);

ALTER TABLE public.creator_signup_requests ENABLE ROW LEVEL SECURITY;
