-- Blocks anon + authenticated clients from reading sensitive profile
-- columns. Migration 001 created `profiles_select FOR SELECT USING (true)`,
-- which means any browser with the shipped anon key can currently
-- enumerate every user's email and stripe_customer_id.
--
-- Rather than tear down the row-level policy (which would break every
-- cross-user join the UI relies on — creator cards, reviews, booking
-- counterparties, waiting-room queue), we leave the row policy public and
-- instead remove column-level SELECT privilege on the two sensitive
-- columns for the client roles. PostgREST will reject any query that
-- references these columns when called with anon or authenticated.
--
-- Server routes (createServiceClient) run as `service_role`, which keeps
-- full SELECT access and is the only path that still reads these columns
-- (prelogin-status, resolve-role, creator-request review, auth/delete-account,
-- Stripe customer lookups). The authenticated client now gets `email` from
-- the JWT (`session.user.email`) instead of the DB — see
-- lib/hooks/useAuth.ts `fetchProfile`.
--
-- Defense-in-depth: we ALSO leave migration 001's profiles_select policy in
-- place so joins like `creator:profiles!creator_id(full_name, username,
-- avatar_*)` keep working — those don't touch the sensitive columns.

REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id) ON public.profiles FROM anon, authenticated;

-- Same treatment on creator_signup_requests: email and phone are PII and
-- only the admin review page (service_role) needs to read them from SQL.
-- The table already had a RESTRICTIVE `no_direct_access` policy added in
-- migration 036, so anon/authenticated can't SELECT rows at all. We still
-- revoke column privileges as belt-and-suspenders in case the policy is
-- ever relaxed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'creator_signup_requests'
      AND column_name = 'email'
  ) THEN
    EXECUTE 'REVOKE SELECT (email) ON public.creator_signup_requests FROM anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'creator_signup_requests'
      AND column_name = 'phone'
  ) THEN
    EXECUTE 'REVOKE SELECT (phone) ON public.creator_signup_requests FROM anon, authenticated';
  END IF;
END $$;
