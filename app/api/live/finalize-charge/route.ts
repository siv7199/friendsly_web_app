import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getLiveBillableDurationSeconds, getLiveFanChargedAmount, getLiveFanChargedAmountCents, getLiveStageElapsedSeconds, LIVE_PREAUTH_MINUTES, LIVE_STAGE_SECONDS } from "@/lib/live";
import { settleManualCapturePaymentIntent } from "@/lib/server/stripe";

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

    const body = await request.json().catch(() => ({}));
    const queueEntryId = typeof body?.queueEntryId === "string" ? body.queueEntryId.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    const VALID_FINAL_STATUSES = ["completed", "skipped", "no_show"];

    if (!queueEntryId) {
      return NextResponse.json({ error: "queueEntryId is required" }, { status: 400 });
    }

    if (status && !VALID_FINAL_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, session_id, admitted_at, duration_seconds, amount_pre_authorized, amount_charged, stripe_pre_auth_id, status, ended_at")
      .eq("id", queueEntryId)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
    }

    const { data: session } = await serviceSupabase
      .from("live_sessions")
      .select("id, creator_id")
      .eq("id", entry.session_id)
      .maybeSingle();

    if (!session || session.creator_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can finalize this charge." }, { status: 403 });
    }

    let durationSeconds = Number(entry.duration_seconds ?? 0);
    let amountCharged = Number(entry.amount_charged ?? 0);
    let finalStatus = entry.status;
    let endedAt = entry.ended_at;

    if (status && entry.status === "active") {
      durationSeconds = getLiveBillableDurationSeconds(
        Math.min(LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds(entry.admitted_at, Date.now()))
      );
      const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
      amountCharged = getLiveFanChargedAmount({
        ratePerMinute,
        durationSeconds,
      });
      endedAt = new Date().toISOString();
      finalStatus = status;

      if (entry.stripe_pre_auth_id) {
        await settleManualCapturePaymentIntent({
          paymentIntentId: entry.stripe_pre_auth_id,
          amountToCaptureCents: getLiveFanChargedAmountCents({
            ratePerMinute,
            durationSeconds,
          }),
        });
      }

      await serviceSupabase
        .from("live_queue_entries")
        .update({
          status,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          amount_charged: amountCharged,
        })
        .eq("id", queueEntryId)
        .eq("status", "active");
    }

    return NextResponse.json({
      ok: true,
      receipt: {
        queueEntryId: entry.id,
        durationSeconds,
        amountCharged,
        charged: amountCharged > 0,
        refundedAmount: 0,
        endedAt,
        status: finalStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
