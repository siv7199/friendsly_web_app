DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO existing_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'bookings'
    AND con.contype = 'f'
    AND con.confrelid = 'public.call_packages'::regclass
    AND con.conkey = ARRAY[
      (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.bookings'::regclass
          AND attname = 'package_id'
      )
    ]::smallint[];

  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', existing_constraint_name);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_package_id_fkey
  FOREIGN KEY (package_id)
  REFERENCES public.call_packages(id)
  ON DELETE SET NULL;
