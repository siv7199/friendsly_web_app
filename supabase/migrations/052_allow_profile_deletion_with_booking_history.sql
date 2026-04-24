-- Allow profile deletion without destroying paid booking/review history.
--
-- Historical records keep their financial/session details, while references to
-- the deleted creator or fan are cleared. Live sessions are ephemeral, so they
-- are removed with the deleted creator profile.

ALTER TABLE public.bookings
  ALTER COLUMN creator_id DROP NOT NULL,
  ALTER COLUMN fan_id DROP NOT NULL;

ALTER TABLE public.reviews
  ALTER COLUMN creator_id DROP NOT NULL,
  ALTER COLUMN fan_id DROP NOT NULL;

ALTER TABLE public.live_queue_entries
  ALTER COLUMN fan_id DROP NOT NULL;

ALTER TABLE public.live_chat_messages
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_creator_id_fkey,
  DROP CONSTRAINT IF EXISTS bookings_fan_id_fkey,
  DROP CONSTRAINT IF EXISTS bookings_cancelled_by_user_id_fkey;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_creator_id_fkey,
  DROP CONSTRAINT IF EXISTS reviews_fan_id_fkey;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_creator_id_fkey;

ALTER TABLE public.live_queue_entries
  DROP CONSTRAINT IF EXISTS live_queue_entries_fan_id_fkey;

ALTER TABLE public.live_chat_messages
  DROP CONSTRAINT IF EXISTS live_chat_messages_user_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_creator_id_fkey
  FOREIGN KEY (creator_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT bookings_fan_id_fkey
  FOREIGN KEY (fan_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT bookings_cancelled_by_user_id_fkey
  FOREIGN KEY (cancelled_by_user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_creator_id_fkey
  FOREIGN KEY (creator_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT reviews_fan_id_fkey
  FOREIGN KEY (fan_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_creator_id_fkey
  FOREIGN KEY (creator_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.live_queue_entries
  ADD CONSTRAINT live_queue_entries_fan_id_fkey
  FOREIGN KEY (fan_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.live_chat_messages
  ADD CONSTRAINT live_chat_messages_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
