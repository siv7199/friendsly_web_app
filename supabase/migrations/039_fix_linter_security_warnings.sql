-- Resolve Supabase database linter security warnings.
--
-- 1. Pin function search_path so SECURITY DEFINER functions cannot resolve
--    objects through a caller-controlled schema path.
-- 2. Remove broad public listing on the public avatars bucket. Public buckets
--    still allow object URL access without a SELECT policy on storage.objects,
--    and the app proxies avatar downloads through the service client.

ALTER FUNCTION public.sync_creator_ratings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.touch_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.increment_profile_views(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.sync_creator_live_status()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
