import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const joinedAt = new Date().toISOString();
    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .update({ admitted_at: joinedAt })
      .eq("session_id", sessionId)
      .eq("fan_id", user.id)
      .eq("status", "active")
      .is("admitted_at", null)
      .select("id, admitted_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Could not mark live join." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      admittedAt: entry?.admitted_at ?? joinedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark live join.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
