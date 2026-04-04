-- ── live_chat_messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read the chat for a creator
CREATE POLICY "chat_select" ON public.live_chat_messages FOR SELECT USING (true);
-- Any authenticated user can send a message
CREATE POLICY "chat_insert" ON public.live_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
