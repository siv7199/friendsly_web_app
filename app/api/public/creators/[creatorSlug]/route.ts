import { NextResponse } from "next/server";
import { MAX_ACTIVE_PACKAGES } from "@/lib/pricing-limits";
import { isUuidLike, normalizeCreatorSlug } from "@/lib/routes";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_SESSION_STALE_MS = 45000;
const CREATOR_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export async function GET(
  _request: Request,
  { params }: { params: { creatorSlug: string } }
) {
  try {
    const creatorRef = params.creatorSlug?.trim();
    if (!creatorRef) {
      return NextResponse.json({ error: "Missing creator slug." }, { status: 400 });
    }
    const creatorLookupColumn = isUuidLike(creatorRef) ? "id" : "username";
    const creatorLookupValue = creatorLookupColumn === "username"
      ? normalizeCreatorSlug(creatorRef)
      : creatorRef;

    if (!creatorLookupValue) {
      return NextResponse.json({ error: "Missing creator slug." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        id, username, full_name, created_at, avatar_initials, avatar_color, avatar_url,
        creator_profiles(
          bio, category, tags, avg_rating, timezone, booking_interval_minutes, live_join_fee,
          is_live, current_live_session_id, scheduled_live_at, scheduled_live_timezone,
          instagram_url, tiktok_url, x_url
        )
      `)
      .eq("role", "creator")
      .eq(creatorLookupColumn, creatorLookupValue)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    const cp = Array.isArray(profile.creator_profiles)
      ? profile.creator_profiles[0]
      : profile.creator_profiles;

    const liveSessionQuery = cp?.current_live_session_id
      ? supabase
          .from("live_sessions")
          .select("id, is_active, daily_room_url, last_heartbeat_at, started_at")
          .eq("id", cp.current_live_session_id)
          .eq("creator_id", profile.id)
          .limit(1)
      : supabase
          .from("live_sessions")
          .select("id, is_active, daily_room_url, last_heartbeat_at, started_at")
          .eq("creator_id", profile.id)
          .eq("is_active", true)
          .not("daily_room_url", "is", null)
          .order("started_at", { ascending: false })
          .limit(1);

    const [packagesRes, availabilityRes, liveSessionsRes, reviewsCountRes, reviewsRes] = await Promise.all([
      supabase
        .from("call_packages")
        .select("id, name, description, duration, price, is_active")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .order("price")
        .limit(MAX_ACTIVE_PACKAGES),
      supabase
        .from("creator_availability")
        .select("id, day_of_week, start_time, end_time, package_id")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .order("day_of_week"),
      liveSessionQuery,
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", profile.id),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, fan:profiles!fan_id(id, full_name, avatar_initials, avatar_color, avatar_url)")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const sessions = liveSessionsRes.data ?? [];
    const freshActiveSession = sessions.find(
      (s: any) =>
        s?.is_active === true &&
        !!s?.daily_room_url &&
        !!s?.last_heartbeat_at &&
        Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
    ) ?? null;
    const activeSession = freshActiveSession ?? sessions.find(
      (s: any) =>
        s?.is_active === true &&
        !!s?.daily_room_url &&
        (!cp?.current_live_session_id || s.id === cp.current_live_session_id)
    ) ?? null;
    const packages = (packagesRes.data ?? []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? "",
      duration: Number(pkg.duration),
      price: Number(pkg.price),
      isActive: Boolean(pkg.is_active),
    }));
    const visiblePackageIds = new Set(packages.map((pkg) => pkg.id));
    const availability = (availabilityRes.data ?? [])
      .filter((slot: any) => !slot.package_id || visiblePackageIds.has(String(slot.package_id)))
      .map((slot: any) => ({
        id: slot.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        package_id: slot.package_id ?? null,
      }));

    return NextResponse.json({
      creator: {
        id: profile.id,
        slug: profile.username,
        name: profile.full_name,
        username: profile.username,
        bio: cp?.bio ?? "",
        category: cp?.category ?? "",
        tags: cp?.tags ?? [],
        rating: Number(cp?.avg_rating ?? 0),
        reviewCount: reviewsCountRes.count ?? 0,
        avatarInitials: profile.avatar_initials,
        avatarColor: profile.avatar_color,
        avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
        instagramUrl: cp?.instagram_url ?? null,
        tiktokUrl: cp?.tiktok_url ?? null,
        xUrl: cp?.x_url ?? null,
        timeZone: cp?.timezone ?? "America/New_York",
        bookingIntervalMinutes: cp?.booking_interval_minutes ? Number(cp.booking_interval_minutes) : 30,
        liveJoinFee: cp?.live_join_fee ? Number(cp.live_join_fee) : null,
        scheduledLiveAt: cp?.scheduled_live_at ?? null,
        scheduledLiveTimeZone: cp?.scheduled_live_timezone ?? cp?.timezone ?? null,
        isLive: Boolean(activeSession),
        currentLiveSessionId: activeSession?.id ?? null,
      },
      reviews: (reviewsRes.data ?? []).map((review: any) => {
        const fan = Array.isArray(review.fan) ? review.fan[0] : review.fan;
        return {
          id: review.id,
          fan: fan?.full_name ?? "Fan",
          initials: fan?.avatar_initials ?? "F",
          color: fan?.avatar_color ?? "bg-violet-500",
          imageUrl: fan?.avatar_url ? `/api/public/avatar/${fan.id}` : undefined,
          rating: Number(review.rating ?? 0),
          comment: review.comment ?? "",
          date: review.created_at,
        };
      }),
      packages,
      availability,
    }, {
      headers: {
        "Cache-Control": CREATOR_CACHE_CONTROL,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load creator.";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { "Cache-Control": CREATOR_CACHE_CONTROL },
      }
    );
  }
}
