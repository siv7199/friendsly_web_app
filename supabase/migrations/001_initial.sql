-- ─────────────────────────────────────────────────────────────────────────────
-- Friendsly — Initial Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Public user data extending auth.users. One row per user.
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  role            TEXT CHECK (role IN ('fan', 'creator')) DEFAULT NULL,
  avatar_url      TEXT,
  avatar_initials TEXT NOT NULL DEFAULT '',
  avatar_color    TEXT NOT NULL DEFAULT 'bg-violet-600',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── creator_profiles ─────────────────────────────────────────────────────────
-- Creator-specific data. Created when a user chooses the "creator" role.
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id                      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio                     TEXT DEFAULT '',
  category                TEXT DEFAULT '',
  tags                    TEXT[] DEFAULT '{}',
  live_rate_per_minute    DECIMAL(10,2) DEFAULT NULL,  -- $/min for public live queue
  is_live                 BOOLEAN DEFAULT FALSE,
  current_live_session_id UUID DEFAULT NULL,
  followers_count         INTEGER DEFAULT 0,
  total_calls             INTEGER DEFAULT 0,
  avg_rating              DECIMAL(3,2) DEFAULT 0,
  review_count            INTEGER DEFAULT 0,
  response_time           TEXT DEFAULT '~5 min',
  next_available          TEXT DEFAULT 'Available this week'
);

-- ── call_packages ─────────────────────────────────────────────────────────────
-- A creator's bookable session offerings (e.g. "Quick Chat — 15 min — $25").
CREATE TABLE IF NOT EXISTS public.call_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  duration        INTEGER NOT NULL,         -- minutes
  price           DECIMAL(10,2) NOT NULL,
  description     TEXT DEFAULT '',
  is_active       BOOLEAN DEFAULT TRUE,
  bookings_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── creator_availability ──────────────────────────────────────────────────────
-- Weekly recurring availability slots shown on a creator's profile calendar.
CREATE TABLE IF NOT EXISTS public.creator_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE
);

-- ── bookings ─────────────────────────────────────────────────────────────────
-- Dedicated pre-paid 1-on-1 sessions. Fan pays upfront, joins at scheduled time.
CREATE TABLE IF NOT EXISTS public.bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                UUID NOT NULL REFERENCES public.profiles(id),
  fan_id                    UUID NOT NULL REFERENCES public.profiles(id),
  package_id                UUID REFERENCES public.call_packages(id),
  scheduled_at              TIMESTAMPTZ NOT NULL,
  duration                  INTEGER NOT NULL,          -- minutes
  price                     DECIMAL(10,2) NOT NULL,
  status                    TEXT DEFAULT 'upcoming'
                              CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  topic                     TEXT,
  stripe_payment_intent_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── live_sessions ─────────────────────────────────────────────────────────────
-- A creator's public live event. Fans join the queue and pay per minute.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES public.profiles(id),
  rate_per_minute  DECIMAL(10,2) NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT TRUE
);

-- ── live_queue_entries ────────────────────────────────────────────────────────
-- Each fan in a live queue. Tracks billing from pre-auth to final charge.
CREATE TABLE IF NOT EXISTS public.live_queue_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  fan_id                UUID NOT NULL REFERENCES public.profiles(id),
  position              INTEGER NOT NULL,
  topic                 TEXT,
  status                TEXT DEFAULT 'waiting'
                          CHECK (status IN ('waiting', 'active', 'completed', 'skipped')),
  joined_at             TIMESTAMPTZ DEFAULT NOW(),
  admitted_at           TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  duration_seconds      INTEGER,                    -- actual seconds on call
  amount_pre_authorized DECIMAL(10,2),              -- held at queue join
  amount_charged        DECIMAL(10,2),              -- final charge after call
  stripe_pre_auth_id    TEXT                        -- PaymentIntent (requires_capture)
);

-- ── reviews ───────────────────────────────────────────────────────────────────
-- Post-call ratings from fans.
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID REFERENCES public.bookings(id),
  creator_id  UUID NOT NULL REFERENCES public.profiles(id),
  fan_id      UUID NOT NULL REFERENCES public.profiles(id),
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- profiles: public read, owner write
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- creator_profiles: public read, owner write
CREATE POLICY "cp_select" ON public.creator_profiles FOR SELECT USING (true);
CREATE POLICY "cp_insert" ON public.creator_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "cp_update" ON public.creator_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "cp_delete" ON public.creator_profiles FOR DELETE USING (auth.uid() = id);

-- call_packages: public read, creator write
CREATE POLICY "pkg_select" ON public.call_packages FOR SELECT USING (true);
CREATE POLICY "pkg_insert" ON public.call_packages FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "pkg_update" ON public.call_packages FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "pkg_delete" ON public.call_packages FOR DELETE USING (auth.uid() = creator_id);

-- creator_availability: public read, creator write
CREATE POLICY "avail_select" ON public.creator_availability FOR SELECT USING (true);
CREATE POLICY "avail_insert" ON public.creator_availability FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "avail_update" ON public.creator_availability FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "avail_delete" ON public.creator_availability FOR DELETE USING (auth.uid() = creator_id);

-- bookings: only the two parties can read/write
CREATE POLICY "book_select" ON public.bookings FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = fan_id);
CREATE POLICY "book_insert" ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = fan_id);
CREATE POLICY "book_update" ON public.bookings FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = fan_id);

-- live_sessions: public read, creator write
CREATE POLICY "ls_select" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "ls_insert" ON public.live_sessions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "ls_update" ON public.live_sessions FOR UPDATE USING (auth.uid() = creator_id);

-- live_queue_entries: fan + session creator can read/write
CREATE POLICY "lq_select" ON public.live_queue_entries FOR SELECT USING (
  auth.uid() = fan_id OR
  auth.uid() = (SELECT creator_id FROM public.live_sessions WHERE id = session_id)
);
CREATE POLICY "lq_insert" ON public.live_queue_entries FOR INSERT WITH CHECK (auth.uid() = fan_id);
CREATE POLICY "lq_update" ON public.live_queue_entries FOR UPDATE USING (
  auth.uid() = fan_id OR
  auth.uid() = (SELECT creator_id FROM public.live_sessions WHERE id = session_id)
);

-- reviews: public read, fan insert
CREATE POLICY "rev_select" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "rev_insert" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = fan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: auto-create profiles row on Supabase Auth signup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_username  TEXT;
  v_initials  TEXT;
  v_colors    TEXT[] := ARRAY[
    'bg-violet-600','bg-purple-600','bg-indigo-600','bg-sky-600',
    'bg-pink-600','bg-rose-600','bg-emerald-600','bg-fuchsia-600'
  ];
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_username  := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));

  -- Derive initials: first letter of first two words
  IF position(' ' IN v_full_name) > 0 THEN
    v_initials := upper(left(v_full_name, 1) || left(split_part(v_full_name, ' ', 2), 1));
  ELSE
    v_initials := upper(left(v_full_name, 2));
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, avatar_initials, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_username,
    v_initials,
    v_colors[floor(random() * 8 + 1)::int]
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
