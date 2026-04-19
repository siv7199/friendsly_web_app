import { createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent, settleManualCapturePaymentIntent } from "@/lib/server/stripe";
import { NextResponse } from "next/server";
import { getLiveChargeAmount, getLiveChargeAmountCents, getLiveStageElapsedSeconds, LIVE_PREAUTH_MINUTES, LIVE_STAGE_SECONDS } from "@/lib/live";

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
      .select("id")
      .eq("id", sessionId)
      .eq("creator_id", creatorId)
      .maybeSingle();

    const { data: sessionEntries } = await supabase
      .from("live_queue_entries")
      .select("id, admitted_at, duration_seconds, amount_pre_authorized, amount_charged, ended_at, stripe_pre_auth_id, status")
      .eq("session_id", sessionId)
      .in("status", ["waiting", "active", "completed", "skipped"])
      .not("stripe_pre_auth_id", "is", null);

    for (const entry of sessionEntries ?? []) {
      if (entry.status === "active") {
        const durationSeconds = Math.max(0, Math.min(LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds(entry.admitted_at, Date.now())));
        const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
        const amountCharged = getLiveChargeAmount({ ratePerMinute, durationSeconds });

        if (entry.stripe_pre_auth_id) {
          await settleManualCapturePaymentIntent({
            paymentIntentId: entry.stripe_pre_auth_id,
            amountToCaptureCents: getLiveChargeAmountCents({ ratePerMinute, durationSeconds }),
          });
        }

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
        continue;
      }

      if (entry.status === "waiting") {
        await refundPaymentIntent({
          paymentIntentId: entry.stripe_pre_auth_id,
          amountToRefundCents: Math.round(Number(entry.amount_pre_authorized ?? 0) * 100),
        });

        await supabase
          .from("live_queue_entries")
          .update({
            status: "skipped",
            ended_at: new Date().toISOString(),
            duration_seconds: 0,
            amount_charged: 0,
          })
          .eq("id", entry.id)
          .eq("status", "waiting");
      }
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
