import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCreatorUser } from "@/lib/server/authz";
import { getCreatorPayoutSummary, syncCreatorPayoutRows } from "@/lib/server/payouts";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireCreatorUser(serviceSupabase, user.id);
    } catch {
      return NextResponse.json({ error: "Only creators can view payout status." }, { status: 403 });
    }

    const { data: payouts } = await serviceSupabase
      .from("payouts")
      .select("id, amount, status, created_at, failure_reason")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    const [account, earnings] = await Promise.all([
      syncCreatorPayoutRows(user.id),
      getCreatorPayoutSummary(user.id),
    ]);

    return NextResponse.json({
      account,
      earnings,
      payouts: payouts ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
