import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
const STORAGE_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const EXTERNAL_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

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

    // Redirecting keeps avatar bytes off the app server and lets the browser/CDN
    // fetch directly from the source.
    const markerIndex = storedUrl.indexOf(STORAGE_PUBLIC_MARKER);
    if (markerIndex !== -1) {
      const response = NextResponse.redirect(storedUrl, { status: 307 });
      response.headers.set("Cache-Control", STORAGE_CACHE_CONTROL);
      return response;
    }

    const response = NextResponse.redirect(storedUrl, { status: 307 });
    response.headers.set("Cache-Control", EXTERNAL_CACHE_CONTROL);
    return response;
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
