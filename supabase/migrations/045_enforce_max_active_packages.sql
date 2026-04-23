CREATE OR REPLACE FUNCTION public.enforce_max_active_call_packages()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_package_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_active, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO active_package_count
  FROM public.call_packages
  WHERE creator_id = NEW.creator_id
    AND is_active = true
    AND id <> COALESCE(NEW.id, gen_random_uuid());

  IF active_package_count >= 3 THEN
    RAISE EXCEPTION 'Creators can only have 3 active packages at a time.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_active_call_packages_on_write ON public.call_packages;

CREATE TRIGGER enforce_max_active_call_packages_on_write
BEFORE INSERT OR UPDATE OF is_active, creator_id
ON public.call_packages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_active_call_packages();
