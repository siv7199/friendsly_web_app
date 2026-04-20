import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";
import { requireFanUser } from "@/lib/server/authz";

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireFanUser(serviceSupabase, user.id);
    } catch {
      return NextResponse.json({ error: "You must use a fan account to claim this booking." }, { status: 403 });
    }

    const { data: tokenRecord, error } = await serviceSupabase
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

    const { data: booking, error: bookingError } = await serviceSupabase
      .from("bookings")
      .select("id, fan_id, booking_owner_type, status")
      .eq("id", tokenRecord.booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.booking_owner_type === "fan") {
      if (booking.fan_id === user.id) {
        return NextResponse.json({ bookingId: booking.id, alreadyClaimed: true });
      }
      return NextResponse.json({ error: "This booking has already been claimed by another account." }, { status: 409 });
    }

    const { data: updatedBooking, error: updateError } = await serviceSupabase
      .from("bookings")
      .update({
        fan_id: user.id,
        booking_owner_type: "fan",
      })
      .eq("id", booking.id)
      .eq("booking_owner_type", "guest")
      .select("id")
      .single();

    if (updateError || !updatedBooking) {
      return NextResponse.json({ error: "Could not claim this booking." }, { status: 400 });
    }

    await serviceSupabase
      .from("booking_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("booking_id", booking.id)
      .is("revoked_at", null);

    return NextResponse.json({ bookingId: updatedBooking.id, alreadyClaimed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not claim booking.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
