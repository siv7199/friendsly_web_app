import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getLiveBillableDurationSeconds,
  getLiveFanChargedAmount,
  getLiveFanChargedAmountCents,
  getLiveStageElapsedSeconds,
  LIVE_PREAUTH_MINUTES,
  LIVE_STAGE_SECONDS,
} from "@/lib/live";
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

    if (!queueEntryId) {
      return NextResponse.json({ error: "queueEntryId is required" }, { status: 400 });
    }

    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, session_id, admitted_at, amount_pre_authorized, stripe_pre_auth_id, status")
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
      return NextResponse.json({ error: "Only the creator can kick this fan." }, { status: 403 });
    }

    if (entry.status !== "active") {
      return NextResponse.json({ ok: true, message: "Fan already left the stage." });
    }

    const durationSeconds = getLiveBillableDurationSeconds(
      Math.min(LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds(entry.admitted_at, Date.now()))
    );
    const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
    const amountCharged = getLiveFanChargedAmount({ ratePerMinute, durationSeconds });
    const endedAt = new Date().toISOString();

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
        status: "skipped",
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        amount_charged: amountCharged,
      })
      .eq("id", queueEntryId)
      .eq("status", "active");

    return NextResponse.json({
      ok: true,
      receipt: {
        queueEntryId: entry.id,
        durationSeconds,
        amountCharged,
        endedAt,
        status: "skipped",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
