import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_SESSION_STALE_MS = 45000;

export async function GET(
  _request: Request,
  { params }: { params: { creatorSlug: string } }
) {
  try {
    const creatorSlug = params.creatorSlug?.trim().toLowerCase();
    if (!creatorSlug) {
      return NextResponse.json({ error: "Missing creator slug." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        id, username, full_name, avatar_initials, avatar_color, avatar_url,
        creator_profiles(
          bio, category, timezone, booking_interval_minutes, live_join_fee,
          is_live, current_live_session_id
        )
      `)
      .eq("role", "creator")
      .eq("username", creatorSlug)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    const [packagesRes, availabilityRes, liveSessionsRes] = await Promise.all([
      supabase
        .from("call_packages")
        .select("id, name, description, duration, price, is_active")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .order("price"),
      supabase
        .from("creator_availability")
        .select("id, day_of_week, start_time, end_time, package_id")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .order("day_of_week"),
      supabase
        .from("live_sessions")
        .select("id, is_active, daily_room_url, last_heartbeat_at, started_at")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .order("started_at", { ascending: false }),
    ]);

    const cp = Array.isArray(profile.creator_profiles)
      ? profile.creator_profiles[0]
      : profile.creator_profiles;
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

    return NextResponse.json({
      creator: {
        id: profile.id,
        slug: profile.username,
        name: profile.full_name,
        username: profile.username,
        bio: cp?.bio ?? "",
        category: cp?.category ?? "",
        avatarInitials: profile.avatar_initials,
        avatarColor: profile.avatar_color,
        avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
        timeZone: cp?.timezone ?? "America/New_York",
        bookingIntervalMinutes: cp?.booking_interval_minutes ? Number(cp.booking_interval_minutes) : 30,
        liveJoinFee: cp?.live_join_fee ? Number(cp.live_join_fee) : null,
        isLive: Boolean(activeSession),
      },
      packages: (packagesRes.data ?? []).map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description ?? "",
        duration: Number(pkg.duration),
        price: Number(pkg.price),
        isActive: Boolean(pkg.is_active),
      })),
      availability: (availabilityRes.data ?? []).map((slot: any) => ({
        id: slot.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        package_id: slot.package_id ?? null,
      })),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load creator.";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  }
}
