import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent } from "@/lib/server/stripe";
import { LIVE_STAGE_SECONDS } from "@/lib/live";

export async function POST(req: Request) {
  try {
    const { creatorId } = await req.json();
    if (!creatorId) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createServiceClient();
    const { data: sessions } = await supabase
      .from("live_sessions")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("is_active", true);

    for (const session of sessions ?? []) {
      const { data: sessionEntries } = await supabase
        .from("live_queue_entries")
        .select("id, admitted_at, duration_seconds, amount_pre_authorized, amount_charged, stripe_pre_auth_id, status")
        .eq("session_id", session.id)
        .in("status", ["waiting", "active", "completed", "skipped"])
        .not("stripe_pre_auth_id", "is", null);

      for (const entry of sessionEntries ?? []) {
        if (entry.status === "active") {
          const durationSeconds = entry.admitted_at
            ? Math.max(0, Math.min(LIVE_STAGE_SECONDS, Math.floor((Date.now() - new Date(entry.admitted_at).getTime()) / 1000)))
            : 0;
          const amountCharged = Number(entry.amount_charged ?? entry.amount_pre_authorized ?? 0);

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
    }

    await supabase
      .from("live_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString(), last_heartbeat_at: null })
      .eq("creator_id", creatorId)
      .eq("is_active", true);

    // Trigger handles creator_profiles.is_live automatically.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
