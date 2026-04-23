-- Prevents client-side privilege escalation into the creator role.
--
-- RLS already restricts profile updates to the owner with a verified email
-- (migration 041). However, there is no column-level restriction, so a fan
-- can update their own profiles.role to 'creator' and insert a matching
-- creator_profiles row directly from the browser using the anon key,
-- bypassing the manual creator-signup review flow entirely.
--
-- Fix:
--   1. Block non-service role changes on profiles.role via a BEFORE UPDATE
--      trigger. Service role (used by the admin review endpoint) still
--      bypasses this, so approved creator promotion continues to work.
--   2. Require an existing profiles.role = 'creator' before a creator_profiles
--      row can be inserted by a client, so a fan cannot seed their own
--      creator row even if step 1 were circumvented.

-- 1) Role-change guard --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_client_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (used by the admin review flow via createServiceClient)
  -- and migrations run as the postgres superuser are allowed through.
  IF auth.role() = 'service_role' OR auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  -- No change to role → allow (most updates hit other columns).
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow the single legitimate client-side transition: fan onboarding,
  -- where a freshly signed-up user with a NULL role claims the 'fan' role
  -- via useAuth.setRole('fan'). Creator promotion must still go through
  -- the service-role admin review flow.
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

-- 2) Defense-in-depth on creator_profiles insert -----------------------------

DROP POLICY IF EXISTS "cp_insert" ON public.creator_profiles;

CREATE POLICY "cp_insert" ON public.creator_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'creator'
    )
  );
