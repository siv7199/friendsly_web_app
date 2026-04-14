ALTER TABLE public.creator_profiles
RENAME COLUMN live_rate_per_minute TO live_join_fee;

ALTER TABLE public.live_sessions
RENAME COLUMN rate_per_minute TO join_fee;
