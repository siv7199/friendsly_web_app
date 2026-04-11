import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  cancelBookingWithRefund,
  getFanCancellationReason,
  inferAutoCancellationReason,
  type BookingCancellationReason,
} from "@/lib/server/bookings";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const mode = body?.mode === "auto" ? "auto" : "manual";
    const bookingId = params.id;

    const { data: booking, error } = await serviceSupabase
      .from("bookings")
      .select("id, creator_id, fan_id, scheduled_at, status, creator_present, fan_present")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      return NextResponse.json({ error: "This booking is no longer cancellable." }, { status: 400 });
    }

    const isCreator = booking.creator_id === user.id;
    const isFan = booking.fan_id === user.id;

    if (!isCreator && !isFan) {
      return NextResponse.json({ error: "Unauthorized participant." }, { status: 403 });
    }

    let reason: BookingCancellationReason;
    let autoCancelled = false;

    if (mode === "auto") {
      reason = inferAutoCancellationReason(booking.creator_present, booking.fan_present);
      autoCancelled = true;
    } else if (isCreator) {
      reason = "creator_cancelled";
    } else {
      reason = getFanCancellationReason(booking.scheduled_at);
    }

    const updatedBooking = await cancelBookingWithRefund({
      bookingId,
      reason,
      actorUserId: mode === "manual" ? user.id : null,
      autoCancelled,
    });

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
