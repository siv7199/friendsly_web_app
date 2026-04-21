import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent } from "@/lib/server/stripe";

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
      return NextResponse.json({ error: "queueEntryId required" }, { status: 400 });
    }

    const { data: entry, error } = await serviceSupabase
      .from("live_queue_entries")
      .select("id, fan_id, status, amount_pre_authorized, stripe_pre_auth_id")
      .eq("id", queueEntryId)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.fan_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (entry.status !== "waiting") {
      return NextResponse.json({ ok: true, message: "Already exited" });
    }

    if (entry.stripe_pre_auth_id) {
      await refundPaymentIntent({
        paymentIntentId: entry.stripe_pre_auth_id,
        amountToRefundCents: Math.round(Number(entry.amount_pre_authorized ?? 0) * 100),
      });
    }

    await serviceSupabase
      .from("live_queue_entries")
      .update({
        status: "skipped",
        ended_at: new Date().toISOString(),
        duration_seconds: 0,
        amount_charged: 0,
      })
      .eq("id", queueEntryId)
      .eq("status", "waiting");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not leave the live queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
