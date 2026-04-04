-- Add session_id to live_chat_messages so chat is scoped per session
ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.live_sessions(id);
