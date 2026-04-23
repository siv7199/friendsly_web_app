import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_CONTROL = "no-store, max-age=0";
const MAX_SESSION_IDS = 50;
const UUID_LIKE_REGEX = /^[0-9a-fA-F-]{32,36}$/;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

function parseSessionIds(request: Request) {
  const url = new URL(request.url);
  return Array.from(
    new Set(
      (url.searchParams.get("sessionIds") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => UUID_LIKE_REGEX.test(value))
        .slice(0, MAX_SESSION_IDS)
    )
  );
}

function getRoomNameFromUrl(dailyRoomUrl?: string | null) {
  if (!dailyRoomUrl) return null;

  try {
    const parsed = new URL(dailyRoomUrl);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    return pathSegments[pathSegments.length - 1] ?? null;
  } catch {
    const pathSegments = dailyRoomUrl.split("/").filter(Boolean);
    return pathSegments[pathSegments.length - 1] ?? null;
  }
}

function countCollection(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return null;
}

function countPresencePayload(payload: unknown): number | null {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  for (const key of ["data", "participants", "presence", "users", "members"]) {
    const count = countCollection(record[key]);
    if (count !== null) return count;
  }

  const metadataKeys = new Set(["error", "info", "message", "room", "room_name", "total_count"]);
  const participantLikeKeys = Object.keys(record).filter((key) => !metadataKeys.has(key));
  if (participantLikeKeys.length > 0) {
    return participantLikeKeys.length;
  }

  return null;
}

function countMeetingPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const meetings = Array.isArray(record.data) ? record.data : [];
  const firstMeeting = meetings[0];
  if (!firstMeeting || typeof firstMeeting !== "object") return null;
  return countCollection((firstMeeting as Record<string, unknown>).participants);
}

async function fetchDailyAudienceCount(roomName: string, apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}` };

  const presenceResponse = await fetch(
    `https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}/presence?limit=1000`,
    { headers, cache: "no-store" }
  );

  if (presenceResponse.ok) {
    const payload = await presenceResponse.json();
    const count = countPresencePayload(payload);
    if (count !== null) return count;
  }

  const meetingsResponse = await fetch(
    `https://api.daily.co/v1/meetings?room=${encodeURIComponent(roomName)}&ongoing=true&limit=1`,
    { headers, cache: "no-store" }
  );

  if (!meetingsResponse.ok) return null;

  const payload = await meetingsResponse.json();
  return countMeetingPayload(payload);
}

export async function GET(request: Request) {
  try {
    const sessionIds = parseSessionIds(request);
    if (sessionIds.length === 0) {
      return jsonResponse({ counts: {} });
    }

    const supabase = createServiceClient();

    const [{ data: sessions }, { data: queueEntries }] = await Promise.all([
      supabase
        .from("live_sessions")
        .select("id, daily_room_url")
        .in("id", sessionIds)
        .eq("is_active", true)
        .not("daily_room_url", "is", null),
      supabase
        .from("live_queue_entries")
        .select("session_id, status")
        .in("session_id", sessionIds)
        .in("status", ["waiting", "active"]),
    ]);

    const counts: Record<string, number> = {};
    (sessions ?? []).forEach((session: any) => {
      counts[String(session.id)] = 1;
    });
    (queueEntries ?? []).forEach((entry: any) => {
      const sessionId = String(entry.session_id ?? "");
      if (!sessionId) return;
      counts[sessionId] = (counts[sessionId] ?? 1) + 1;
    });

    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      return jsonResponse({ counts, source: "db_fallback" });
    }

    await Promise.all(
      (sessions ?? []).map(async (session: any) => {
        const sessionId = String(session.id);
        const roomName = getRoomNameFromUrl(session.daily_room_url);
        if (!roomName) return;

        try {
          const audienceCount = await fetchDailyAudienceCount(roomName, dailyApiKey);
          if (typeof audienceCount === "number" && audienceCount >= 0) {
            counts[sessionId] = audienceCount;
          }
        } catch {
          // Keep the database fallback count if the Daily lookup fails.
        }
      })
    );

    return jsonResponse({ counts, source: "daily" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load live audience counts.";
    return jsonResponse({ error: message, counts: {} }, 500);
  }
}
