UPDATE public.profiles AS profiles
SET avatar_url = COALESCE(
  auth_users.raw_user_meta_data->>'avatar_url',
  auth_users.raw_user_meta_data->>'picture',
  auth_users.raw_user_meta_data->>'avatar'
)
FROM auth.users AS auth_users
WHERE auth_users.id = profiles.id
  AND profiles.avatar_url IS NULL
  AND COALESCE(
    auth_users.raw_user_meta_data->>'avatar_url',
    auth_users.raw_user_meta_data->>'picture',
    auth_users.raw_user_meta_data->>'avatar'
  ) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_username  TEXT;
  v_initials  TEXT;
  v_avatar_url TEXT;
  v_colors    TEXT[] := ARRAY[
    'bg-violet-600','bg-purple-600','bg-indigo-600','bg-sky-600',
    'bg-pink-600','bg-rose-600','bg-emerald-600','bg-fuchsia-600'
  ];
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_username  := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar'
  );

  IF position(' ' IN v_full_name) > 0 THEN
    v_initials := upper(left(v_full_name, 1) || left(split_part(v_full_name, ' ', 2), 1));
  ELSE
    v_initials := upper(left(v_full_name, 2));
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, avatar_url, avatar_initials, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_username,
    v_avatar_url,
    v_initials,
    v_colors[floor(random() * 8 + 1)::int]
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
