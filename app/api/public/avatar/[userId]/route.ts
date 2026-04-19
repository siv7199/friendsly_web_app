import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    if (!userId) return new NextResponse(null, { status: 400 });

    const supabase = createServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const storedUrl = profile?.avatar_url;
    if (!storedUrl) return new NextResponse(null, { status: 404 });

    // If it's a Supabase Storage URL, download it via the service client
    // so bucket privacy settings are irrelevant.
    const markerIndex = storedUrl.indexOf(STORAGE_PUBLIC_MARKER);
    if (markerIndex !== -1) {
      const storagePath = storedUrl.slice(markerIndex + STORAGE_PUBLIC_MARKER.length);

      const { data: blob, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .download(storagePath);

      if (error || !blob) return new NextResponse(null, { status: 404 });

      const buffer = await blob.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": blob.type || "image/jpeg",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // For non-storage URLs (e.g. Google OAuth profile pictures), proxy the fetch
    // server-side so browser CORS/referrer restrictions don't block it.
    const upstream = await fetch(storedUrl, {
      headers: { "User-Agent": "Friendsly/1.0" },
    });

    if (!upstream.ok) return new NextResponse(null, { status: 404 });

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
