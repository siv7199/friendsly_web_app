import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { creatorId } = await req.json();
    if (!creatorId) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createServiceClient();
    await supabase
      .from("live_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("creator_id", creatorId)
      .eq("is_active", true);

    // Trigger handles creator_profiles.is_live automatically.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
