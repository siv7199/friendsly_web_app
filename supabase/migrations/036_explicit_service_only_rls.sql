-- Make service-only tables explicitly inaccessible to direct client roles.
-- These tables are used through server routes with the service key and should
-- not be readable or writable from anon/authenticated clients directly.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_contacts'
      AND policyname = 'guest_contacts_no_direct_access'
  ) THEN
    EXECUTE 'DROP POLICY "guest_contacts_no_direct_access" ON public.guest_contacts';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "guest_contacts_no_direct_access"
    ON public.guest_contacts
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false)
  $policy$;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_checkout_sessions'
      AND policyname = 'guest_checkout_sessions_no_direct_access'
  ) THEN
    EXECUTE 'DROP POLICY "guest_checkout_sessions_no_direct_access" ON public.guest_checkout_sessions';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "guest_checkout_sessions_no_direct_access"
    ON public.guest_checkout_sessions
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false)
  $policy$;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_access_tokens'
      AND policyname = 'booking_access_tokens_no_direct_access'
  ) THEN
    EXECUTE 'DROP POLICY "booking_access_tokens_no_direct_access" ON public.booking_access_tokens';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "booking_access_tokens_no_direct_access"
    ON public.booking_access_tokens
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false)
  $policy$;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_signup_requests'
      AND policyname = 'creator_signup_requests_no_direct_access'
  ) THEN
    EXECUTE 'DROP POLICY "creator_signup_requests_no_direct_access" ON public.creator_signup_requests';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "creator_signup_requests_no_direct_access"
    ON public.creator_signup_requests
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false)
  $policy$;
END $$;

-- Tighten direct inserts for analytics events. Normal page view tracking goes
-- through the increment_profile_views RPC, so direct table inserts should only
-- be accepted when the viewer is the authenticated caller.
DROP POLICY IF EXISTS "creator_profile_view_events_insert" ON public.creator_profile_view_events;
CREATE POLICY "creator_profile_view_events_insert"
ON public.creator_profile_view_events
FOR INSERT
WITH CHECK (
  viewer_id IS NULL OR auth.uid() = viewer_id
);
