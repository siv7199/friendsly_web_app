import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isUuid, readJsonBody, stringField } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const sessionId = stringField(body, "sessionId", 80);
    const dailySessionId = stringField(body, "dailySessionId", 120) || null;

    if (!sessionId || !isUuid(sessionId)) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const { data: existingEntry, error: existingError } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, admitted_at")
      .eq("session_id", sessionId)
      .eq("fan_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: "Could not mark live join." }, { status: 400 });
    }

    if (!existingEntry) {
      return NextResponse.json({ error: "Active live turn not found." }, { status: 404 });
    }

    const admittedAt = existingEntry.admitted_at ?? new Date().toISOString();
    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .update({
        admitted_at: admittedAt,
        admitted_daily_session_id: dailySessionId ?? null,
      })
      .eq("id", existingEntry.id)
      .eq("status", "active")
      .select("id, admitted_at, admitted_daily_session_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Could not mark live join." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      admittedAt: entry?.admitted_at ?? admittedAt,
      admittedDailySessionId: entry?.admitted_daily_session_id ?? dailySessionId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark live join.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
