import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { settleManualCapturePaymentIntent } from "@/lib/server/stripe";

export async function POST(req: Request) {
  try {
    const { creatorId } = await req.json();
    if (!creatorId) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createServiceClient();
    const { data: sessions } = await supabase
      .from("live_sessions")
      .select("id, rate_per_minute")
      .eq("creator_id", creatorId)
      .eq("is_active", true);

    for (const session of sessions ?? []) {
      const { data: sessionEntries } = await supabase
        .from("live_queue_entries")
        .select("id, admitted_at, duration_seconds, amount_charged, stripe_pre_auth_id, status")
        .eq("session_id", session.id)
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
            ? Number((((durationSeconds / 60) * Number(session.rate_per_minute ?? 0))).toFixed(2))
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
