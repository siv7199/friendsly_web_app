ALTER TABLE public.creator_availability
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.call_packages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS creator_availability_creator_package_idx
ON public.creator_availability (creator_id, package_id, day_of_week);
