import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_SESSION_STALE_MS = 45000;
const LIVE_STATUS_CACHE_CONTROL = "no-store";

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
        id, username,
        creator_profiles(live_join_fee, current_live_session_id, scheduled_live_at, scheduled_live_timezone, timezone)
      `)
      .eq("role", "creator")
      .eq("username", creatorSlug)
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

    const { data: liveSessions } = await liveSessionQuery;

    const sessions = liveSessions ?? [];
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

    return NextResponse.json(
      {
        creator: {
          id: profile.id,
          slug: profile.username,
          isLive: Boolean(activeSession),
          currentLiveSessionId: activeSession?.id ?? null,
          liveJoinFee: cp?.live_join_fee ? Number(cp.live_join_fee) : null,
          scheduledLiveAt: cp?.scheduled_live_at ?? null,
          scheduledLiveTimeZone: cp?.scheduled_live_timezone ?? cp?.timezone ?? null,
        },
      },
      {
        headers: {
          "Cache-Control": LIVE_STATUS_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load live status.";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { "Cache-Control": LIVE_STATUS_CACHE_CONTROL },
      }
    );
  }
}
