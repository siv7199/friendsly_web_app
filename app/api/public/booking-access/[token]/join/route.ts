import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBookingWindow, hasBookingEnded, shouldAutoCancelBooking } from "@/lib/bookings";
import { cancelBookingWithRefund, inferAutoCancellationReason } from "@/lib/server/bookings";
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

    if (booking.status === "cancelled" || booking.status === "completed") {
      return NextResponse.json({ error: "This booking is no longer available to join." }, { status: 400 });
    }

    if (
      shouldAutoCancelBooking(
        booking.status,
        booking.scheduled_at,
        booking.creator_present,
        booking.fan_present
      )
    ) {
      await cancelBookingWithRefund({
        bookingId: booking.id,
        reason: inferAutoCancellationReason(booking.creator_present, booking.fan_present),
        autoCancelled: true,
      });

      return NextResponse.json(
        { error: "This booking was auto-cancelled because both participants were not in the call 5 minutes after the scheduled start time." },
        { status: 400 }
      );
    }

    if (hasBookingEnded(booking.scheduled_at, booking.duration)) {
      await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id);

      return NextResponse.json({ error: "This booking has already ended." }, { status: 400 });
    }

    const { joinOpensAt } = getBookingWindow(booking.scheduled_at, booking.duration);
    if (Date.now() < joinOpensAt.getTime()) {
      return NextResponse.json(
        {
          error: `This room opens 5 minutes before the booking starts at ${new Date(booking.scheduled_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}.`,
        },
        { status: 400 }
      );
    }

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      return NextResponse.json({ error: "Missing Daily configuration." }, { status: 500 });
    }

    let roomUrl = booking.daily_room_url;
    if (!roomUrl) {
      const roomRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          privacy: "private",
          properties: {
            exp: Math.round(Date.now() / 1000) + 60 * 60 * 2,
          },
        }),
      });

      if (!roomRes.ok) {
        return NextResponse.json({ error: "Failed to create video room." }, { status: 500 });
      }

      const roomData = await roomRes.json();
      roomUrl = roomData.url;
      const { data: claimedBooking } = await supabase
        .from("bookings")
        .update({
          daily_room_url: roomUrl,
          status: booking.status === "upcoming" ? "live" : booking.status,
        })
        .eq("id", booking.id)
        .is("daily_room_url", null)
        .select("daily_room_url")
        .maybeSingle();

      if (!claimedBooking?.daily_room_url) {
        const { data: latestBooking } = await supabase
          .from("bookings")
          .select("daily_room_url")
          .eq("id", booking.id)
          .single();

        if (latestBooking?.daily_room_url) {
          roomUrl = latestBooking.daily_room_url;
        }
      }
    } else if (booking.status === "upcoming") {
      await supabase
        .from("bookings")
        .update({ status: "live" })
        .eq("id", booking.id);
    }

    const roomName = new URL(roomUrl).pathname.split("/").filter(Boolean).pop();
    if (!roomName) {
      return NextResponse.json({ error: "Invalid booking room URL." }, { status: 500 });
    }

    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: false,
          user_name: booking.guest_name_snapshot || "Guest",
        },
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Failed to generate access token." }, { status: 500 });
    }

    const { token } = await tokenRes.json();

    await supabase
      .from("booking_access_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    return NextResponse.json({
      url: roomUrl,
      token,
      bookingId: booking.id,
      guestName: booking.guest_name_snapshot || "Guest",
      creatorName: booking.creator?.full_name || "Creator",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join booking room.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
