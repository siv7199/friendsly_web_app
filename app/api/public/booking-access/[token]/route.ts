import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashAccessToken } from "@/lib/server/booking-access";
import { getBookingWindow, isBookingJoinable } from "@/lib/bookings";
import { BOOKING_LATE_CANCEL_HOURS, getFanCancellationReason, getLateFeeAmountForPrice, getRefundAmountForReason, isLateFeeRequired } from "@/lib/server/bookings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
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
          scheduled_at,
          duration,
          price,
          topic,
          creator_present,
          fan_present,
          creator_joined_at,
          late_fee_amount,
          late_fee_paid_at,
          guest_name_snapshot,
          guest_email_snapshot,
          creator:profiles!creator_id(id, full_name, username, avatar_initials, avatar_color, avatar_url)
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
    const window = getBookingWindow(booking.scheduled_at, Number(booking.duration ?? 0));
    const cancellationReason = getFanCancellationReason(booking.scheduled_at);
    const lateFeeAmount = Number(booking.late_fee_paid_at ? booking.late_fee_amount ?? 0 : 0);
    const refundAmount = getRefundAmountForReason(Number(booking.price ?? 0), cancellationReason, lateFeeAmount);
    const lateFeeRequired = isLateFeeRequired({
      scheduledAt: booking.scheduled_at,
      lateFeePaidAt: booking.late_fee_paid_at,
      creatorPresent: booking.creator_present,
      creatorJoinedAt: booking.creator_joined_at,
    });

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduled_at,
        duration: Number(booking.duration ?? 0),
        topic: booking.topic ?? null,
        guestName: booking.guest_name_snapshot ?? "Guest",
        guestEmail: booking.guest_email_snapshot ?? null,
        creator: booking.creator
          ? {
              ...booking.creator,
              avatar_url: booking.creator.avatar_url && booking.creator.id
                ? `/api/public/avatar/${booking.creator.id}`
                : null,
            }
          : null,
        joinOpensAt: window.joinOpensAt.toISOString(),
        endsAt: window.endsAt.toISOString(),
        canJoinNow: isBookingJoinable(
          booking.status,
          booking.scheduled_at,
          Number(booking.duration ?? 0),
          new Date(),
          booking.creator_present,
          booking.fan_present
        ),
        canCancel: booking.status === "upcoming",
        refundAmount,
        lateFeeRequired,
        lateFeeAmount: lateFeeRequired ? getLateFeeAmountForPrice(Number(booking.price ?? 0)) : lateFeeAmount,
        refundPolicyText:
          cancellationReason === "fan_cancelled_late"
            ? `Cancelling within ${BOOKING_LATE_CANCEL_HOURS} hours refunds 50% of the booking price.`
            : `Cancelling more than ${BOOKING_LATE_CANCEL_HOURS} hours before the call refunds the full booking price.`,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load booking access.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
