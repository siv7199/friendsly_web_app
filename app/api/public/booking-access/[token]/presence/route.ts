import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const { present } = await request.json();
    if (typeof present !== "boolean") {
      return NextResponse.json({ error: "Presence state is required." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("booking_access_tokens")
      .select("booking_id, expires_at, revoked_at")
      .eq("token_hash", hashAccessToken(rawToken))
      .is("revoked_at", null)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: "Booking access link is invalid." }, { status: 404 });
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Booking access link has expired." }, { status: 410 });
    }

    const updates = {
      fan_present: present,
      fan_joined_at: present ? new Date().toISOString() : null,
    };

    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", tokenRecord.booking_id)
      .eq("booking_owner_type", "guest")
      .in("status", ["upcoming", "live"])
      .select("*")
      .single();

    if (updateError || !updatedBooking) {
      return NextResponse.json({ error: "Could not update booking presence." }, { status: 400 });
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update booking presence.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
