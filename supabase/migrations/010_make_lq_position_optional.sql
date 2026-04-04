-- 010_make_lq_position_optional.sql
-- In the new self-healing queue model, we calculate position from joined_at
-- rather than storing a hard-coded number. This migration makes the column optional.

ALTER TABLE public.live_queue_entries 
ALTER COLUMN position DROP NOT NULL;
