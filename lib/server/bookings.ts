import { getBookingWindow, getBookingGrossAmount, isFanLateForBookingJoin } from "@/lib/bookings";
import { getTimeZoneParts } from "@/lib/timezones";
import { createServiceClient } from "@/lib/supabase/server";
import { refundPaymentIntent } from "@/lib/server/stripe";

export const BOOKING_CONFLICT_STATUSES = ["upcoming", "live"] as const;
export const BOOKING_LATE_CANCEL_HOURS = 24;

export type BookingCancellationReason =
  | "fan_cancelled_early"
  | "fan_cancelled_late"
  | "creator_cancelled"
  | "auto_cancel_both_absent"
  | "auto_cancel_creator_no_show"
  | "auto_cancel_fan_no_show";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function compareDateParts(
  left: { year: number; month: number; day: number },
  right: { year: number; month: number; day: number }
) {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function inferAutoCancellationReason(
  creatorPresent: boolean | null | undefined,
  fanPresent: boolean | null | undefined
): BookingCancellationReason {
  if (creatorPresent && !fanPresent) return "auto_cancel_fan_no_show";
  if (fanPresent && !creatorPresent) return "auto_cancel_creator_no_show";
  return "auto_cancel_both_absent";
}

export function getLateFeeAmountForPrice(price: number) {
  return roundCurrency(price * 0.1);
}

export function isLateFeeRequired(params: {
  scheduledAt: string | Date;
  lateFeePaidAt?: string | null;
  now?: Date;
}) {
  const { scheduledAt, lateFeePaidAt, now = new Date() } = params;
  return !lateFeePaidAt && isFanLateForBookingJoin(scheduledAt, now);
}

export function getRefundAmountForReason(
  price: number,
  reason: BookingCancellationReason,
  lateFeeAmount: number = 0
) {
  if (reason === "fan_cancelled_late") {
    return roundCurrency(price * 0.5);
  }

  if (reason === "auto_cancel_fan_no_show") {
    return 0;
  }

  if (reason === "auto_cancel_both_absent" || reason === "auto_cancel_creator_no_show") {
    return roundCurrency(price + lateFeeAmount);
  }

  return roundCurrency(price);
}

export function getRetainedBookingAmount(price: number, refundAmount: number | null | undefined) {
  return Math.max(0, roundCurrency(price - Number(refundAmount ?? 0)));
}


export function getFanCancellationReason(
  scheduledAt: string | Date,
  now: Date = new Date()
): BookingCancellationReason {
  const start = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  const lateWindowStart = new Date(start.getTime() - (BOOKING_LATE_CANCEL_HOURS * 60 * 60 * 1000));
  return now.getTime() >= lateWindowStart.getTime() ? "fan_cancelled_late" : "fan_cancelled_early";
}

export function bookingRangesOverlap(
  first: { scheduled_at: string | Date; duration: number },
  second: { scheduled_at: string | Date; duration: number }
) {
  const firstStart = new Date(first.scheduled_at).getTime();
  const secondStart = new Date(second.scheduled_at).getTime();
  const firstEnd = getBookingWindow(first.scheduled_at, first.duration).endsAt.getTime();
  const secondEnd = getBookingWindow(second.scheduled_at, second.duration).endsAt.getTime();
  return firstStart < secondEnd && secondStart < firstEnd;
}

export async function findBookingConflicts(params: {
  creatorId: string;
  fanId: string;
  scheduledAt: string | Date;
  duration: number;
  excludeBookingId?: string;
}) {
  const { creatorId, fanId, scheduledAt, duration, excludeBookingId } = params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, creator_id, fan_id, scheduled_at, duration, status")
    .in("status", [...BOOKING_CONFLICT_STATUSES])
    .or(`creator_id.eq.${creatorId},fan_id.eq.${fanId}`);

  if (error) {
    throw new Error("Could not verify booking conflicts.");
  }

  return (data ?? []).filter((booking: any) => {
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    return bookingRangesOverlap(
      { scheduled_at: booking.scheduled_at, duration: booking.duration },
      { scheduled_at: scheduledAt, duration }
    );
  });
}

export async function validateBookingSelection(params: {
  creatorId: string;
  packageId: string;
  scheduledAt: string | Date;
}) {
  const { creatorId, packageId, scheduledAt } = params;
  const supabase = createServiceClient();

  const [{ data: creatorProfile, error: creatorError }, { data: pkg, error: packageError }, { data: availability, error: availabilityError }] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("timezone, booking_interval_minutes")
      .eq("id", creatorId)
      .single(),
    supabase
      .from("call_packages")
      .select("id, creator_id, name, duration, price, is_active")
      .eq("id", packageId)
      .eq("creator_id", creatorId)
      .single(),
    supabase
      .from("creator_availability")
      .select("day_of_week, start_time, end_time, package_id")
      .eq("creator_id", creatorId)
      .eq("is_active", true),
  ]);

  if (creatorError || !creatorProfile) {
    throw new Error("Creator profile not found.");
  }
  if (packageError || !pkg || !pkg.is_active) {
    throw new Error("This offering is no longer available.");
  }
  if (availabilityError) {
    throw new Error("Could not verify creator availability.");
  }

  const creatorTimeZone = creatorProfile.timezone ?? "America/New_York";
  const bookingIntervalMinutes = Number(creatorProfile.booking_interval_minutes ?? 30);
  const scheduledDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  const scheduledLocal = getTimeZoneParts(scheduledDate, creatorTimeZone);
  const nowLocal = getTimeZoneParts(new Date(), creatorTimeZone);

  if (compareDateParts(scheduledLocal, nowLocal) <= 0) {
    throw new Error("Bookings must be scheduled for at least the next day.");
  }

  const scheduledMinutes = (scheduledLocal.hour * 60) + scheduledLocal.minute;
  if (scheduledMinutes % bookingIntervalMinutes !== 0) {
    throw new Error("This booking time is no longer available.");
  }

  const matchingSlot = (availability ?? []).find((slot: any) => {
    if (slot.day_of_week !== scheduledLocal.weekday) return false;
    if (slot.package_id && slot.package_id !== packageId) return false;

    const slotStart = parseTimeToMinutes(String(slot.start_time).slice(0, 5));
    const slotEnd = parseTimeToMinutes(String(slot.end_time).slice(0, 5));
    const bookingEndsAt = scheduledMinutes + Number(pkg.duration);
    return scheduledMinutes >= slotStart && bookingEndsAt <= slotEnd;
  });

  if (!matchingSlot) {
    throw new Error("This booking time is outside the creator's availability.");
  }

  return {
    creatorTimeZone,
    bookingIntervalMinutes,
    package: {
      id: String(pkg.id),
      name: String(pkg.name),
      duration: Number(pkg.duration),
      price: Number(pkg.price),
      creatorId: String(pkg.creator_id),
    },
  };
}

export async function cancelBookingWithRefund(params: {
  bookingId: string;
  reason: BookingCancellationReason;
  actorUserId?: string | null;
  autoCancelled?: boolean;
}) {
  const { bookingId, reason, actorUserId = null, autoCancelled = false } = params;
  const supabase = createServiceClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, price, stripe_payment_intent_id, refund_amount, late_fee_amount, late_fee_payment_intent_id, late_fee_paid_at")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    throw new Error("Booking not found.");
  }

  if (booking.status === "cancelled") {
    return booking;
  }

  const bookingPrice = Number(booking.price);
  const lateFeeAmount = booking.late_fee_paid_at ? Number(booking.late_fee_amount ?? 0) : 0;
  const refundAmount = getRefundAmountForReason(bookingPrice, reason, lateFeeAmount);
  let stripeRefundId: string | null = null;
  let lateFeeRefundId: string | null = null;
  let refundedAt: string | null = null;

  const bookingRefundAmount = Math.min(refundAmount, bookingPrice);
  if (booking.stripe_payment_intent_id && bookingRefundAmount > 0) {
    const refund = await refundPaymentIntent({
      paymentIntentId: String(booking.stripe_payment_intent_id),
      amountToRefundCents: Math.round(bookingRefundAmount * 100),
    });
    stripeRefundId = refund.refundId;
    refundedAt = new Date().toISOString();
  }

  const lateFeeRefundAmount = Math.max(0, roundCurrency(refundAmount - bookingRefundAmount));
  if (booking.late_fee_payment_intent_id && lateFeeRefundAmount > 0) {
    const refund = await refundPaymentIntent({
      paymentIntentId: String(booking.late_fee_payment_intent_id),
      amountToRefundCents: Math.round(lateFeeRefundAmount * 100),
    });
    lateFeeRefundId = refund.refundId;
    refundedAt = refundedAt ?? new Date().toISOString();
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      creator_present: false,
      fan_present: false,
      cancellation_reason: reason,
      cancelled_by_user_id: actorUserId,
      refund_amount: refundAmount,
      stripe_refund_id: stripeRefundId,
      late_fee_refund_id: lateFeeRefundId,
      refunded_at: refundedAt,
      auto_cancelled_at: autoCancelled ? new Date().toISOString() : null,
    })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (updateError || !updatedBooking) {
    throw new Error("Could not cancel booking.");
  }

  return updatedBooking;
}
