-- ── booking_room_url ────────────────────────────────────────────────────────
-- Add daily_room_url column to bookings table to store the video room URL
-- for scheduled calls.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS daily_room_url TEXT;

-- Update RLS policies to ensure both creator and fan can see the room URL
-- The existing policies on 'bookings' already cover SELECT for creator_id and fan_id.
-- Let's double check them and add specific ones if needed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'bookings_select_owner'
  ) THEN
    CREATE POLICY "bookings_select_owner" ON public.bookings
      FOR SELECT USING (auth.uid() = fan_id OR auth.uid() = creator_id);
  END IF;
END $$;
