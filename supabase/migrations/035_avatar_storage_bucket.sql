-- Ensure the avatars storage bucket exists and is public.
-- Without this, getPublicUrl() returns a URL that 403s because the bucket
-- either doesn't exist yet or was created as private.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public           = true,
      file_size_limit  = 10485760,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Allow anyone (including unauthenticated visitors) to read avatar files.
-- This is required for the public booking page to display creator photos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Avatar images are publicly readable'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Avatar images are publicly readable"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'avatars')
    $policy$;
  END IF;
END $$;

-- Allow authenticated users to upload into their own folder (user-id prefix).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can upload their own avatar'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can upload their own avatar"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  END IF;
END $$;

-- Allow authenticated users to update/replace their own avatar file.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can update their own avatar'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update their own avatar"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  END IF;
END $$;

-- Allow authenticated users to delete their own avatar file.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can delete their own avatar'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete their own avatar"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  END IF;
END $$;
