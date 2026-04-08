import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/server/stripe";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(params.id);
  if (paymentMethod.customer == null) {
    return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id || paymentMethod.customer !== profile.stripe_customer_id) {
    return NextResponse.json({ error: "Unauthorized payment method." }, { status: 403 });
  }

  await stripe.paymentMethods.detach(params.id);
  return NextResponse.json({ ok: true });
}
