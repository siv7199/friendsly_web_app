import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { findBookingConflicts, validateBookingSelection } from "@/lib/server/bookings";
import {
  isIsoDate,
  isUuid,
  readJsonBody,
  stringField,
} from "@/lib/server/request-security";

export async function PATCH(
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

    const bookingId = params.id;
    if (!isUuid(bookingId)) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const body = await readJsonBody(request);
    const scheduledAt = stringField(body, "scheduledAt", 80);
    const topic = stringField(body, "topic", 500);

    if (!isIsoDate(scheduledAt)) {
      return NextResponse.json({ error: "Choose a valid booking time." }, { status: 400 });
    }

    const { data: booking, error } = await serviceSupabase
      .from("bookings")
      .select("id, creator_id, fan_id, package_id, status")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.fan_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized participant." }, { status: 403 });
    }

    if (booking.status !== "upcoming") {
      return NextResponse.json({ error: "Only upcoming bookings can be edited." }, { status: 400 });
    }

    const packageId = String(booking.package_id ?? "");
    if (!isUuid(packageId)) {
      return NextResponse.json({ error: "This booking cannot be rescheduled." }, { status: 400 });
    }

    const bookingSelection = await validateBookingSelection({
      creatorId: String(booking.creator_id),
      packageId,
      scheduledAt,
    });

    const conflicts = await findBookingConflicts({
      creatorId: String(booking.creator_id),
      fanId: user.id,
      scheduledAt,
      duration: bookingSelection.package.duration,
      excludeBookingId: bookingId,
    });

    if (conflicts.length > 0) {
      return NextResponse.json({ error: "That time is no longer available." }, { status: 400 });
    }

    const { data: updatedBooking, error: updateError } = await serviceSupabase
      .from("bookings")
      .update({
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration: bookingSelection.package.duration,
        topic: topic || null,
      })
      .eq("id", bookingId)
      .select("id, scheduled_at, duration, topic")
      .single();

    if (updateError || !updatedBooking) {
      throw new Error("Could not update booking.");
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
