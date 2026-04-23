export const BOOKING_EARLY_JOIN_MINUTES = 5;
export const BOOKING_FAN_LATE_FEE_MINUTES = 5;
export const BOOKING_NO_SHOW_GRACE_MINUTES = 10;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function getBookingWindow(scheduledAt: string | Date, durationMinutes: number) {
  const start = toDate(scheduledAt);
  const joinOpensAt = new Date(start.getTime() - BOOKING_EARLY_JOIN_MINUTES * 60 * 1000);
  const fanLateFeeStartsAt = new Date(start.getTime() + BOOKING_FAN_LATE_FEE_MINUTES * 60 * 1000);
  const noShowDeadline = new Date(start.getTime() + BOOKING_NO_SHOW_GRACE_MINUTES * 60 * 1000);
  const endsAt = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return { start, joinOpensAt, fanLateFeeStartsAt, noShowDeadline, endsAt };
}

export function isFanLateForBookingJoin(
  scheduledAt: string | Date,
  now: Date = new Date()
) {
  const { fanLateFeeStartsAt } = getBookingWindow(scheduledAt, 0);
  return now.getTime() >= fanLateFeeStartsAt.getTime();
}

export function getBookingGrossAmount(
  price: number,
  lateFeeAmount: number | null | undefined = 0,
  lateFeePaidAt?: string | null
) {
  return roundCurrency(price + (lateFeePaidAt ? Number(lateFeeAmount ?? 0) : 0));
}

export function isBookingJoinable(
  status: string,
  scheduledAt: string | Date,
  durationMinutes: number,
  now: Date = new Date(),
  creatorPresent?: boolean | null,
  fanPresent?: boolean | null
) {
  if (status === "completed" || status === "cancelled") return false;

  const { joinOpensAt, noShowDeadline, endsAt } = getBookingWindow(scheduledAt, durationMinutes);
  const nowMs = now.getTime();

  if (nowMs >= noShowDeadline.getTime() && !(Boolean(creatorPresent) && Boolean(fanPresent))) {
    return false;
  }

  return nowMs >= joinOpensAt.getTime() && nowMs <= endsAt.getTime();
}

export function hasBookingEnded(
  scheduledAt: string | Date,
  durationMinutes: number,
  now: Date = new Date()
) {
  const { endsAt } = getBookingWindow(scheduledAt, durationMinutes);
  return now.getTime() > endsAt.getTime();
}

export function shouldAutoCancelBooking(
  status: string,
  scheduledAt: string | Date,
  creatorPresent: boolean | null | undefined,
  fanPresent: boolean | null | undefined,
  now: Date = new Date()
) {
  if (status === "completed" || status === "cancelled") return false;

  const { noShowDeadline } = getBookingWindow(scheduledAt, 0);
  if (now.getTime() < noShowDeadline.getTime()) return false;

  return !(Boolean(creatorPresent) && Boolean(fanPresent));
}

export function deriveBookingStatus(
  status: string,
  scheduledAt: string | Date,
  durationMinutes: number,
  now: Date = new Date(),
  creatorPresent?: boolean | null,
  fanPresent?: boolean | null
) {
  if (shouldAutoCancelBooking(status, scheduledAt, creatorPresent, fanPresent, now)) {
    return "cancelled";
  }

  if ((status === "upcoming" || status === "live") && hasBookingEnded(scheduledAt, durationMinutes, now)) {
    return "completed";
  }

  return status;
}

export function getNextBookingRefreshDelay(
  bookings: Array<{
    status: string;
    scheduledAt: string | Date;
    duration: number;
  }>,
  now: Date = new Date()
) {
  const nowMs = now.getTime();
  let nextTransitionMs: number | null = null;

  for (const booking of bookings) {
    if (booking.status === "completed" || booking.status === "cancelled") continue;

    const { joinOpensAt, fanLateFeeStartsAt, noShowDeadline, endsAt } = getBookingWindow(booking.scheduledAt, booking.duration);
    const candidateTimes = [joinOpensAt.getTime(), fanLateFeeStartsAt.getTime(), noShowDeadline.getTime(), endsAt.getTime()];

    for (const candidateMs of candidateTimes) {
      if (candidateMs <= nowMs) continue;
      if (nextTransitionMs === null || candidateMs < nextTransitionMs) {
        nextTransitionMs = candidateMs;
      }
    }
  }

  if (nextTransitionMs === null) return null;
  return Math.max(1000, nextTransitionMs - nowMs + 1000);
}

export function getNextAutoCancelCheckDelay(
  bookings: Array<{
    status: string;
    scheduledAt: string | Date;
    creatorPresent?: boolean | null;
    fanPresent?: boolean | null;
  }>,
  now: Date = new Date()
) {
  const nowMs = now.getTime();
  let nextDeadlineMs: number | null = null;

  for (const booking of bookings) {
    if (booking.status === "completed" || booking.status === "cancelled") continue;
    if (Boolean(booking.creatorPresent) && Boolean(booking.fanPresent)) continue;

    const { noShowDeadline } = getBookingWindow(booking.scheduledAt, 0);
    const deadlineMs = noShowDeadline.getTime();

    if (deadlineMs <= nowMs) {
      return 0;
    }

    if (nextDeadlineMs === null || deadlineMs < nextDeadlineMs) {
      nextDeadlineMs = deadlineMs;
    }
  }

  if (nextDeadlineMs === null) return null;
  return Math.max(1000, nextDeadlineMs - nowMs + 1000);
}
