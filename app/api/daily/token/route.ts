import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Daily room names are alphanumeric + hyphens only
const ROOM_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-]{0,99}$/;

export async function POST(req: Request) {
  try {
    const { roomName, isOwner = false, userName } = await req.json();

    if (!roomName || typeof roomName !== "string" || !ROOM_NAME_REGEX.test(roomName)) {
      return NextResponse.json({ error: "roomName is required" }, { status: 400 });
    }

    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Exact suffix match — roomName is already validated to contain no wildcards
    const { data: liveSession } = await serviceSupabase
      .from("live_sessions")
      .select("id, creator_id")
      .eq("is_active", true)
      .like("daily_room_url", `%/${roomName}`)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!liveSession) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    if (Boolean(isOwner) && liveSession.creator_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can request an owner token." }, { status: 403 });
    }

    // Fans must have an admitted (active) queue entry before receiving a token.
    // Without this check any signed-in user who knows the room name could join
    // a live call for free by bypassing the queue entirely.
    if (liveSession.creator_id !== user.id) {
      const { data: queueEntry } = await serviceSupabase
        .from("live_queue_entries")
        .select("id")
        .eq("session_id", liveSession.id)
        .eq("fan_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!queueEntry) {
        return NextResponse.json(
          { error: "You have not been admitted to this live session." },
          { status: 403 }
        );
      }
    }

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      return NextResponse.json(
        { error: "DAILY_API_KEY is not set" },
        { status: 500 }
      );
    }

    // Create a meeting token
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: Boolean(isOwner) && liveSession.creator_id === user.id,
          user_name: typeof userName === "string" && userName === user.id ? userName : user.id,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Failed to create token:", errorText);
      return NextResponse.json(
        { error: "Failed to create Daily token" },
        { status: tokenRes.status }
      );
    }

    const tokenData = await tokenRes.json();

    return NextResponse.json({
      token: tokenData.token,
    });
  } catch (error: any) {
    console.error("Server error creating token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
