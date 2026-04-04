-- 011_sync_ratings.sql
-- This migration ensures that the avg_rating and review_count columns in creator_profiles
-- are always in sync with the actual data in the reviews table.

CREATE OR REPLACE FUNCTION public.sync_creator_ratings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the creator_profiles table for the creator associated with the review
  UPDATE public.creator_profiles
  SET 
    avg_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
      FROM public.reviews
      WHERE creator_id = COALESCE(NEW.creator_id, OLD.creator_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE creator_id = COALESCE(NEW.creator_id, OLD.creator_id)
    )
  WHERE id = COALESCE(NEW.creator_id, OLD.creator_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for any review changes
DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_creator_ratings();

-- Perform a one-time sync for all existing creators
UPDATE public.creator_profiles cp
SET 
  avg_rating = (
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    FROM public.reviews
    WHERE creator_id = cp.id
  ),
  review_count = (
    SELECT COUNT(*)
    FROM public.reviews
    WHERE creator_id = cp.id
  );
