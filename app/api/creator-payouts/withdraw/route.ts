import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCreatorPayoutSummary, syncStripeConnectAccountStatus } from "@/lib/server/payouts";
import { stripe } from "@/lib/server/stripe";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await request.json();
    const requestedAmount = Number(amount);
    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ error: "Invalid withdrawal amount." }, { status: 400 });
    }

    const account = await syncStripeConnectAccountStatus(user.id);
    if (!account.accountId || !account.payoutsEnabled) {
      return NextResponse.json({ error: "Finish Stripe payout setup before withdrawing." }, { status: 400 });
    }

    const summary = await getCreatorPayoutSummary(user.id);
    if (requestedAmount > summary.withdrawable + 0.001) {
      return NextResponse.json({
        error: `You can withdraw up to $${summary.withdrawable.toFixed(2)} right now based on Stripe's available balance.`,
      }, { status: 400 });
    }

    const { data: existingProcessingPayout } = await serviceSupabase
      .from("payouts")
      .select("id")
      .eq("creator_id", user.id)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();

    if (existingProcessingPayout) {
      return NextResponse.json({ error: "A payout is already processing. Please wait for it to finish before withdrawing again." }, { status: 400 });
    }

    const amountCents = Math.round(requestedAmount * 100);
    const { data: payoutRow, error: insertError } = await serviceSupabase
      .from("payouts")
      .insert({
        creator_id: user.id,
        amount: requestedAmount,
        status: "processing",
      })
      .select("*")
      .single();

    if (insertError || !payoutRow) {
      return NextResponse.json({ error: "Could not create payout record." }, { status: 500 });
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: account.accountId,
        metadata: {
          creator_id: user.id,
          payout_id: payoutRow.id,
        },
      });

      const { data: updatedPayout } = await serviceSupabase
        .from("payouts")
        .update({
          status: "completed",
          stripe_id: null,
          stripe_transfer_id: transfer.id,
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRow.id)
        .select("*")
        .single();

      return NextResponse.json({
        payout: updatedPayout ?? payoutRow,
      });
    } catch (stripeError) {
      const message = stripeError instanceof Error ? stripeError.message : "Could not send payout.";
      await serviceSupabase
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRow.id);

      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
