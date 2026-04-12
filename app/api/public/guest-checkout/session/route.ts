import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeEmail, normalizePhone } from "@/lib/server/booking-access";
import { validateBookingSelection } from "@/lib/server/bookings";

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const creatorId = String(body.creatorId ?? "");
    const packageId = String(body.packageId ?? "");
    const scheduledAt = String(body.scheduledAt ?? "");
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const guestName = normalizeName(body.guestName);
    const guestEmail = normalizeEmail(body.guestEmail);
    const guestPhone = normalizePhone(body.guestPhone);

    if (!creatorId || !packageId || !scheduledAt || !guestName || (!guestEmail && !guestPhone)) {
      return NextResponse.json({ error: "Missing guest checkout details." }, { status: 400 });
    }

    await validateBookingSelection({ creatorId, packageId, scheduledAt });

    const supabase = createServiceClient();
    let guestContactId: string | null = null;

    if (guestEmail) {
      const { data: existingByEmail } = await supabase
        .from("guest_contacts")
        .select("id")
        .eq("normalized_email", guestEmail)
        .maybeSingle();
      guestContactId = existingByEmail?.id ?? null;
    }

    if (!guestContactId && guestPhone) {
      const { data: existingByPhone } = await supabase
        .from("guest_contacts")
        .select("id")
        .eq("normalized_phone", guestPhone)
        .maybeSingle();
      guestContactId = existingByPhone?.id ?? null;
    }

    if (!guestContactId) {
      const { data: createdGuest, error: guestError } = await supabase
        .from("guest_contacts")
        .insert({
          full_name: guestName,
          email: guestEmail || null,
          phone: guestPhone || null,
          normalized_email: guestEmail || null,
          normalized_phone: guestPhone || null,
        })
        .select("id")
        .single();

      if (guestError || !createdGuest) {
        throw new Error("Could not create guest contact.");
      }

      guestContactId = createdGuest.id;
    } else {
      await supabase
        .from("guest_contacts")
        .update({
          full_name: guestName,
          email: guestEmail || null,
          phone: guestPhone || null,
          normalized_email: guestEmail || null,
          normalized_phone: guestPhone || null,
        })
        .eq("id", guestContactId);
    }

    const { data: session, error: sessionError } = await supabase
      .from("guest_checkout_sessions")
      .insert({
        creator_id: creatorId,
        package_id: packageId,
        guest_contact_id: guestContactId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        topic: topic || null,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      throw new Error("Could not create checkout session.");
    }

    return NextResponse.json({
      guestCheckoutSessionId: session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start guest checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
