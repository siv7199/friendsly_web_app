import { createServiceClient } from "@/lib/supabase/server";
import { settleManualCapturePaymentIntent } from "@/lib/server/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { creatorId, sessionId } = await req.json();
    const supabase = createServiceClient();

    if (!creatorId || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`[Disconnect Beacon] Ending live session ${sessionId} for creator ${creatorId}`);

    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, rate_per_minute")
      .eq("id", sessionId)
      .eq("creator_id", creatorId)
      .maybeSingle();

    const { data: sessionEntries } = await supabase
      .from("live_queue_entries")
      .select("id, admitted_at, duration_seconds, amount_charged, ended_at, stripe_pre_auth_id, status")
      .eq("session_id", sessionId)
      .in("status", ["active", "completed", "skipped"])
      .not("stripe_pre_auth_id", "is", null);

    for (const entry of sessionEntries ?? []) {
      const durationSeconds =
        entry.status === "active"
          ? entry.admitted_at
            ? Math.max(0, Math.floor((Date.now() - new Date(entry.admitted_at).getTime()) / 1000))
            : 0
          : Number(entry.duration_seconds ?? 0);
      const amountCharged =
        entry.status === "active"
          ? Number((((durationSeconds / 60) * Number(session?.rate_per_minute ?? 0))).toFixed(2))
          : Number(entry.amount_charged ?? 0);

      if (entry.status === "active") {
        await supabase
          .from("live_queue_entries")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            amount_charged: amountCharged,
          })
          .eq("id", entry.id)
          .eq("status", "active");
      }

      await settleManualCapturePaymentIntent({
        paymentIntentId: entry.stripe_pre_auth_id,
        amountToCaptureCents: Math.round(amountCharged * 100),
      });
    }

    await supabase
      .from("live_sessions")
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        last_heartbeat_at: null,
      })
      .eq("id", sessionId)
      .eq("creator_id", creatorId);

    await supabase
      .from("creator_profiles")
      .update({
        is_live: false,
        current_live_session_id: null,
      })
      .eq("id", creatorId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Disconnect Beacon] Error during cleanup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
