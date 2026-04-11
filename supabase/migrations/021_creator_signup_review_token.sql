ALTER TABLE public.creator_signup_requests
ADD COLUMN IF NOT EXISTS review_token UUID DEFAULT gen_random_uuid();

UPDATE public.creator_signup_requests
SET review_token = gen_random_uuid()
WHERE review_token IS NULL;

ALTER TABLE public.creator_signup_requests
ALTER COLUMN review_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_signup_requests_review_token
  ON public.creator_signup_requests (review_token);
