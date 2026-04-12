import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";
import { cancelBookingWithRefund, getFanCancellationReason } from "@/lib/server/bookings";

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
      .select(`
        booking_id,
        expires_at,
        revoked_at,
        booking:bookings!booking_id(
          id,
          status,
          scheduled_at
        )
      `)
      .eq("token_hash", hashAccessToken(rawToken))
      .is("revoked_at", null)
      .single();

    if (error || !tokenRecord || !tokenRecord.booking) {
      return NextResponse.json({ error: "Booking access link is invalid." }, { status: 404 });
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Booking access link has expired." }, { status: 410 });
    }

    const booking = (tokenRecord as any).booking;

    if (booking.status === "completed" || booking.status === "cancelled") {
      return NextResponse.json({ error: "This booking is no longer cancellable." }, { status: 400 });
    }

    const updatedBooking = await cancelBookingWithRefund({
      bookingId: booking.id,
      reason: getFanCancellationReason(booking.scheduled_at),
      actorUserId: null,
      autoCancelled: false,
    });

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
