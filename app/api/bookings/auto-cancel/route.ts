import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { shouldAutoCancelBooking } from "@/lib/bookings";
import { cancelBookingWithRefund, inferAutoCancellationReason } from "@/lib/server/bookings";

export async function POST() {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: bookings, error } = await serviceSupabase
      .from("bookings")
      .select("id, creator_id, fan_id, scheduled_at, status, creator_present, fan_present")
      .in("status", ["upcoming", "live"])
      .or(`creator_id.eq.${user.id},fan_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: "Could not load bookings." }, { status: 400 });
    }

    const cancelledIds: string[] = [];

    for (const booking of bookings ?? []) {
      if (
        !shouldAutoCancelBooking(
          booking.status,
          booking.scheduled_at,
          booking.creator_present,
          booking.fan_present
        )
      ) {
        continue;
      }

      const updatedBooking = await cancelBookingWithRefund({
        bookingId: booking.id,
        reason: inferAutoCancellationReason(booking.creator_present, booking.fan_present),
        autoCancelled: true,
      });

      cancelledIds.push(updatedBooking.id);
    }

    return NextResponse.json({ cancelledIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not auto-cancel stale bookings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
