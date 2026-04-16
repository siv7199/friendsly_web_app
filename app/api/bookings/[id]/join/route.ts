import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBookingWindow, hasBookingEnded, shouldAutoCancelBooking } from "@/lib/bookings";
import { cancelBookingWithRefund, getLateFeeAmountForPrice, inferAutoCancellationReason, isLateFeeRequired } from "@/lib/server/bookings";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch booking details
    const { data: booking, error: fetchError } = await serviceSupabase
      .from("bookings")
      .select("*, creator:profiles!creator_id(full_name)")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 2. Verify participant
    const isCreator = booking.creator_id === user.id;
    const isFan = booking.fan_id === user.id;

    if (!isCreator && !isFan) {
      return NextResponse.json({ error: "Unauthorized participant" }, { status: 403 });
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
        bookingId,
        reason: inferAutoCancellationReason(booking.creator_present, booking.fan_present),
        autoCancelled: true,
      });

      return NextResponse.json(
        { error: "This booking was auto-cancelled because both participants were not in the call 10 minutes after the scheduled start time." },
        { status: 400 }
      );
    }

    if (isFan && isLateFeeRequired({
      scheduledAt: booking.scheduled_at,
      lateFeePaidAt: booking.late_fee_paid_at,
      creatorPresent: booking.creator_present,
      creatorJoinedAt: booking.creator_joined_at,
    })) {
      return NextResponse.json(
        {
          error: "Joining more than 5 minutes after the booking start requires a 10% late fee when the creator is already waiting.",
          requiresLateFee: true,
          lateFeeAmount: getLateFeeAmountForPrice(Number(booking.price ?? 0)),
        },
        { status: 402 }
      );
    }

    if (hasBookingEnded(booking.scheduled_at, booking.duration)) {
      await serviceSupabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", bookingId);

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

    // 3. Create Daily room if it doesn't exist
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
            exp: Math.round(Date.now() / 1000) + 60 * 60 * 2, // 2 hours from now
          },
        }),
      });

      if (!roomRes.ok) {
        const err = await roomRes.text();
        console.error("Daily room creation failed:", err);
        return NextResponse.json({ error: "Failed to create video room" }, { status: 500 });
      }

      const roomData = await roomRes.json();
      roomUrl = roomData.url;
      // Attempt to claim the booking room only if another request has not already set it.
      const { data: claimedBooking, error: claimError } = await serviceSupabase
        .from("bookings")
        .update({
          daily_room_url: roomUrl,
          status: booking.status === "upcoming" ? "live" : booking.status
        })
        .eq("id", bookingId)
        .is("daily_room_url", null)
        .select("daily_room_url, status")
        .maybeSingle();

      if (claimError) {
        console.error("Failed to claim booking Daily room:", claimError);
      }

      if (!claimedBooking?.daily_room_url) {
        // Another participant won the race and stored the canonical room first.
        const { data: latestBooking } = await serviceSupabase
          .from("bookings")
          .select("daily_room_url, status")
          .eq("id", bookingId)
          .single();

        if (latestBooking?.daily_room_url) {
          roomUrl = latestBooking.daily_room_url;
        } else {
          return NextResponse.json({ error: "Could not establish a shared booking room." }, { status: 500 });
        }
      }
    } else if (booking.status === "upcoming") {
      // If room already exists but status is still upcoming, move to live
      await serviceSupabase
        .from("bookings")
        .update({ status: "live" })
        .eq("id", bookingId);
    }

    // 4. Create meeting token
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
          is_owner: isCreator,
          user_name: user.user_metadata?.full_name || (isCreator ? "Creator" : "Fan"),
        },
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
    }

    const { token } = await tokenRes.json();

    return NextResponse.json({
      url: roomUrl,
      token,
      isCreator
    });
  } catch (error: any) {
    console.error("Error joining booking room:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
