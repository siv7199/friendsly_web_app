import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent, settleManualCapturePaymentIntent } from "@/lib/server/stripe";
import { getLiveBillableDurationSeconds, getLiveFanChargedAmount, getLiveFanChargedAmountCents, getLivePreauthFanChargeAmountCents, getLiveStageElapsedSeconds, LIVE_PREAUTH_MINUTES, LIVE_STAGE_SECONDS } from "@/lib/live";

export async function POST(req: Request) {
  try {
    const { creatorId } = await req.json();
    if (!creatorId) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id !== creatorId) {
      return NextResponse.json({ error: "Only the creator can end this live session." }, { status: 403 });
    }

    const { data: sessions } = await serviceSupabase
      .from("live_sessions")
      .select("id")
      .eq("creator_id", user.id)
      .eq("is_active", true);

    for (const session of sessions ?? []) {
      const { data: sessionEntries } = await serviceSupabase
        .from("live_queue_entries")
        .select("id, admitted_at, duration_seconds, amount_pre_authorized, amount_charged, stripe_pre_auth_id, status")
        .eq("session_id", session.id)
        .in("status", ["waiting", "active", "completed", "skipped"])
        .not("stripe_pre_auth_id", "is", null);

      for (const entry of sessionEntries ?? []) {
        if (entry.status === "active") {
          const durationSeconds = getLiveBillableDurationSeconds(
            Math.min(LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds(entry.admitted_at, Date.now()))
          );
          const ratePerMinute = Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES;
          const amountCharged = getLiveFanChargedAmount({ ratePerMinute, durationSeconds });

          if (entry.stripe_pre_auth_id) {
            await settleManualCapturePaymentIntent({
              paymentIntentId: entry.stripe_pre_auth_id,
              amountToCaptureCents: getLiveFanChargedAmountCents({ ratePerMinute, durationSeconds }),
            });
          }

          await serviceSupabase
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
            amountToRefundCents: getLivePreauthFanChargeAmountCents(
              Number(entry.amount_pre_authorized ?? 0) / LIVE_PREAUTH_MINUTES
            ),
          });

          await serviceSupabase
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
    }

    await serviceSupabase
      .from("live_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString(), last_heartbeat_at: null })
      .eq("creator_id", user.id)
      .eq("is_active", true);

    // Trigger handles creator_profiles.is_live automatically.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
