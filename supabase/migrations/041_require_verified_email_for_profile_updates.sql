-- Require Supabase-confirmed email before a client can update their profile.
-- This blocks unverified signups from assigning themselves a fan/creator role
-- through the browser client or a hand-written API request.

CREATE OR REPLACE FUNCTION public.current_auth_user_email_verified()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_auth_user_email_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_auth_user_email_verified() TO authenticated;

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND public.current_auth_user_email_verified()
);
