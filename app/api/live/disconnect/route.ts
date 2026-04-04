import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { creatorId, sessionId } = await req.json();
    const supabase = await createClient();

    if (!creatorId || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`[Disconnect Beacon] Cleaning up session ${sessionId} for creator ${creatorId}`);

    // 1. (REMOVED) Deactivate the session
    // We NO LONGER kill the session on disconnect/refresh. 
    // Only the explicit "End Session" button should do this.
    // This ensures fans are not orphaned when a creator refreshes.

    // 2. Mark creator as offline (but KEEP the current_live_session_id so fans can still find us)
    await supabase
      .from("creator_profiles")
      .update({ 
        is_live: false
        // REMOVED: current_live_session_id: null
      })
      .eq("id", creatorId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Disconnect Beacon] Error during cleanup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
