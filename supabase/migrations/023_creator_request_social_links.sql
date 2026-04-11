ALTER TABLE public.creator_signup_requests
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
ADD COLUMN IF NOT EXISTS x_url TEXT;

UPDATE public.creator_signup_requests
SET instagram_url = social_link
WHERE instagram_url IS NULL
  AND social_link IS NOT NULL
  AND social_link ILIKE '%instagram.com%';

UPDATE public.creator_signup_requests
SET tiktok_url = social_link
WHERE tiktok_url IS NULL
  AND social_link IS NOT NULL
  AND social_link ILIKE '%tiktok.com%';

UPDATE public.creator_signup_requests
SET x_url = social_link
WHERE x_url IS NULL
  AND social_link IS NOT NULL
  AND (
    social_link ILIKE '%x.com%'
    OR social_link ILIKE '%twitter.com%'
  );

ALTER TABLE public.creator_signup_requests
ALTER COLUMN social_link DROP NOT NULL;
