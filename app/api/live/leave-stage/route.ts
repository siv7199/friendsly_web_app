import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getLiveBillableDurationSeconds, getLiveStageElapsedSeconds, getLiveFanChargedAmount, getLiveFanChargedAmountCents, LIVE_PREAUTH_MINUTES } from "@/lib/live";
import { settleManualCapturePaymentIntent } from "@/lib/server/stripe";

// Fan-initiated leave-stage: charges for elapsed time and marks the entry completed.
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const queueEntryId = typeof body?.queueEntryId === "string" ? body.queueEntryId.trim() : "";
    if (!queueEntryId) return NextResponse.json({ error: "queueEntryId required" }, { status: 400 });

    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, fan_id, session_id, admitted_at, amount_pre_authorized, stripe_pre_auth_id, status")
      .eq("id", queueEntryId)
      .single();

    if (error || !entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (entry.fan_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (entry.status !== "active") return NextResponse.json({ ok: true, message: "Already ended" });

    const durationSeconds = getLiveBillableDurationSeconds(
      getLiveStageElapsedSeconds(entry.admitted_at, Date.now())
    );
    const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
    const amountCharged = getLiveFanChargedAmount({ ratePerMinute, durationSeconds });
    const endedAt = new Date().toISOString();

    if (entry.stripe_pre_auth_id) {
      await settleManualCapturePaymentIntent({
        paymentIntentId: entry.stripe_pre_auth_id,
        amountToCaptureCents: getLiveFanChargedAmountCents({ ratePerMinute, durationSeconds }),
      });
    }

    await serviceSupabase
      .from("live_queue_entries")
      .update({ status: "completed", ended_at: endedAt, duration_seconds: durationSeconds, amount_charged: amountCharged })
      .eq("id", queueEntryId)
      .eq("status", "active");

    return NextResponse.json({ ok: true, durationSeconds, amountCharged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
