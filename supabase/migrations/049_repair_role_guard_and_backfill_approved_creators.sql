-- Reassert the intended client role guard after project cutover/manual edits.
-- Also backfill creator profiles for requests that were marked approved without
-- running the normal approval flow.

CREATE OR REPLACE FUNCTION public.prevent_client_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS NULL AND NEW.role = 'fan' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'role can only be changed by the server'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_client_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_client_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_client_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_role_change();

WITH approved_requests AS (
  SELECT DISTINCT ON (lower(email))
    lower(email) AS email
  FROM public.creator_signup_requests
  WHERE status = 'approved'
  ORDER BY lower(email), reviewed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.profiles AS profiles
SET role = 'creator'
FROM approved_requests
WHERE lower(profiles.email) = approved_requests.email
  AND profiles.role IS DISTINCT FROM 'creator';

INSERT INTO public.creator_profiles (id)
SELECT profiles.id
FROM public.profiles AS profiles
JOIN (
  SELECT DISTINCT ON (lower(email))
    lower(email) AS email
  FROM public.creator_signup_requests
  WHERE status = 'approved'
  ORDER BY lower(email), reviewed_at DESC NULLS LAST, created_at DESC
) AS approved_requests
  ON lower(profiles.email) = approved_requests.email
ON CONFLICT (id) DO NOTHING;

UPDATE auth.users AS users
SET raw_user_meta_data = COALESCE(users.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'creator')
FROM public.profiles AS profiles
WHERE users.id = profiles.id
  AND profiles.role = 'creator'
  AND COALESCE(users.raw_user_meta_data ->> 'role', '') IS DISTINCT FROM 'creator';

UPDATE public.creator_signup_requests
SET reviewed_at = COALESCE(reviewed_at, NOW())
WHERE status = 'approved'
  AND reviewed_at IS NULL;
