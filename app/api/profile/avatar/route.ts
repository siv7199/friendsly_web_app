import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/server/request-security";

const AVATAR_BUCKET = "avatars";

function extractStoragePathFromUrl(url: string | null | undefined) {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  return url.slice(markerIndex + marker.length);
}

async function ensureAvatarBucket() {
  const serviceSupabase = createServiceClient();
  const { data: buckets, error: listError } = await serviceSupabase.storage.listBuckets();

  if (listError) {
    console.error("[avatar] listBuckets failed:", listError.message);
  }

  const exists = buckets?.some((bucket) => bucket.name === AVATAR_BUCKET) ?? false;
  const bucketConfig = {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as string[],
  };

  if (!exists) {
    const { error } = await serviceSupabase.storage.createBucket(AVATAR_BUCKET, bucketConfig);
    if (error && !error.message.includes("already exists")) {
      console.error("[avatar] createBucket failed:", error.message);
    }
    // always attempt updateBucket regardless — createBucket may silently no-op on conflict
  }

  const { error: updateError } = await serviceSupabase.storage.updateBucket(AVATAR_BUCKET, bucketConfig);
  if (updateError) {
    console.error("[avatar] updateBucket failed:", updateError.message);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "avatar-upload", {
      key: user.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No avatar file provided." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Avatar must be an image file." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Avatar must be 10 MB or smaller." }, { status: 400 });
    }

    await ensureAvatarBucket();

    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null;
    const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceSupabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicUrlData } = serviceSupabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    const nextUrl = publicUrlData.publicUrl;

    const { data: currentProfile } = await serviceSupabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    await serviceSupabase
      .from("profiles")
      .update({ avatar_url: nextUrl })
      .eq("id", user.id);

    const oldPath = extractStoragePathFromUrl(currentProfile?.avatar_url);
    // Only remove the previous file if it lives under this user's own prefix.
    // avatar_url is client-writable via RLS, so without this scope check a
    // caller could point their own avatar_url at another user's object and
    // have the service client delete it on the next upload.
    if (oldPath && oldPath.startsWith(`${user.id}/`)) {
      await serviceSupabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    return NextResponse.json({ avatarUrl: nextUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload avatar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentProfile } = await serviceSupabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    await serviceSupabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    const oldPath = extractStoragePathFromUrl(currentProfile?.avatar_url);
    if (oldPath && oldPath.startsWith(`${user.id}/`)) {
      await serviceSupabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove avatar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
