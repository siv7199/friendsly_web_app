import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: tokenRecord, error } = await supabase
      .from("booking_access_tokens")
      .select("id, booking_id, expires_at, revoked_at")
      .eq("token_hash", hashAccessToken(rawToken))
      .is("revoked_at", null)
      .single();

    if (error || !tokenRecord) {
      return NextResponse.json({ error: "Booking access link is invalid." }, { status: 404 });
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Booking access link has expired." }, { status: 410 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, creator:profiles!creator_id(full_name)")
      .eq("id", tokenRecord.booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.booking_owner_type !== "guest") {
      return NextResponse.json({ error: "This booking should be joined from a signed-in account." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Guests must create or sign in to a fan account before joining this booking." },
      { status: 403 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join booking room.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
