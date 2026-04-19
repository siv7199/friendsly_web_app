import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getLiveChargeAmount, getLiveChargeAmountCents, getLiveStageElapsedSeconds, LIVE_PREAUTH_MINUTES, LIVE_STAGE_SECONDS } from "@/lib/live";
import { settleManualCapturePaymentIntent } from "@/lib/server/stripe";

export async function POST(request: Request) {
  try {
    const { queueEntryId, status } = await request.json();

    if (!queueEntryId) {
      return NextResponse.json({ error: "queueEntryId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: entry, error } = await supabase
      .from("live_queue_entries")
      .select("id, admitted_at, duration_seconds, amount_pre_authorized, amount_charged, stripe_pre_auth_id, status, ended_at")
      .eq("id", queueEntryId)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
    }

    let durationSeconds = Number(entry.duration_seconds ?? 0);
    let amountCharged = Number(entry.amount_charged ?? 0);
    let finalStatus = entry.status;
    let endedAt = entry.ended_at;

    if (status && entry.status === "active") {
      durationSeconds = Math.max(0, Math.min(LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds(entry.admitted_at, Date.now())));
      const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
      amountCharged = getLiveChargeAmount({
        ratePerMinute,
        durationSeconds,
      });
      endedAt = new Date().toISOString();
      finalStatus = status;

      if (entry.stripe_pre_auth_id) {
        await settleManualCapturePaymentIntent({
          paymentIntentId: entry.stripe_pre_auth_id,
          amountToCaptureCents: getLiveChargeAmountCents({
            ratePerMinute,
            durationSeconds,
          }),
        });
      }

      await supabase
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
