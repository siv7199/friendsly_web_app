import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
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
      .select("id, admitted_at, duration_seconds, amount_charged, stripe_pre_auth_id, status, ended_at, live_sessions(rate_per_minute)")
      .eq("id", queueEntryId)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
    }

    let durationSeconds = Number(entry.duration_seconds ?? 0);
    let amountCharged = Number(entry.amount_charged ?? 0);
    let finalStatus = entry.status;
    let endedAt = entry.ended_at;
    const paymentIntentId = entry.stripe_pre_auth_id;

    if (status && entry.status === "active") {
      durationSeconds = entry.admitted_at
        ? Math.max(0, Math.floor((Date.now() - new Date(entry.admitted_at).getTime()) / 1000))
        : 0;
      const ratePerMinute = Number((entry.live_sessions as any)?.rate_per_minute ?? 0);
      amountCharged = Number((((durationSeconds / 60) * ratePerMinute)).toFixed(2));
      endedAt = new Date().toISOString();
      finalStatus = status;

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

    if (!paymentIntentId) {
      return NextResponse.json({
        ok: true,
        receipt: {
          queueEntryId: entry.id,
          durationSeconds,
          amountCharged,
          charged: false,
          endedAt,
          status: finalStatus,
        },
      });
    }

    const captureAmount = Math.max(0, Math.round(amountCharged * 100));
    const settlement = await settleManualCapturePaymentIntent({
      paymentIntentId,
      amountToCaptureCents: captureAmount,
    });

    return NextResponse.json({
      ok: true,
      receipt: {
        queueEntryId: entry.id,
        durationSeconds,
        amountCharged,
        charged: settlement.charged,
        refundedAmount: settlement.refundedAmount / 100,
        endedAt,
        status: finalStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
