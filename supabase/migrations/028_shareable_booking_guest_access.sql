CREATE TABLE IF NOT EXISTS public.guest_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  normalized_email TEXT,
  normalized_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guest_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.call_packages(id) ON DELETE CASCADE,
  guest_contact_id UUID NOT NULL REFERENCES public.guest_contacts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  topic TEXT,
  payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'abandoned')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  completed_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_contact_id UUID NOT NULL REFERENCES public.guest_contacts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'manage'
    CHECK (purpose IN ('manage', 'join')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bookings
  ALTER COLUMN fan_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_contact_id UUID REFERENCES public.guest_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_owner_type TEXT NOT NULL DEFAULT 'fan'
    CHECK (booking_owner_type IN ('fan', 'guest')),
  ADD COLUMN IF NOT EXISTS guest_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS guest_email_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_guest_contacts_normalized_email
  ON public.guest_contacts (normalized_email);

CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_creator_id
  ON public.guest_checkout_sessions (creator_id);

CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_guest_contact_id
  ON public.guest_checkout_sessions (guest_contact_id);

CREATE INDEX IF NOT EXISTS idx_booking_access_tokens_booking_id
  ON public.booking_access_tokens (booking_id);

ALTER TABLE public.guest_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_guest_contacts_updated_at ON public.guest_contacts;
CREATE TRIGGER touch_guest_contacts_updated_at
  BEFORE UPDATE ON public.guest_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_guest_checkout_sessions_updated_at ON public.guest_checkout_sessions;
CREATE TRIGGER touch_guest_checkout_sessions_updated_at
  BEFORE UPDATE ON public.guest_checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
