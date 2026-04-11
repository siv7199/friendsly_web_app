WITH ranked_open_entries AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, fan_id
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        COALESCE(admitted_at, joined_at) DESC,
        joined_at DESC,
        id DESC
    ) AS row_num
  FROM public.live_queue_entries
  WHERE status IN ('waiting', 'active')
)
DELETE FROM public.live_queue_entries target
USING ranked_open_entries ranked
WHERE target.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS live_queue_entries_one_open_entry_per_fan_session_idx
ON public.live_queue_entries (session_id, fan_id)
WHERE status IN ('waiting', 'active');
