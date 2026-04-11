export const BOOKING_EARLY_JOIN_MINUTES = 5;
export const BOOKING_NO_SHOW_GRACE_MINUTES = 5;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getBookingWindow(scheduledAt: string | Date, durationMinutes: number) {
  const start = toDate(scheduledAt);
  const joinOpensAt = new Date(start.getTime() - BOOKING_EARLY_JOIN_MINUTES * 60 * 1000);
  const noShowDeadline = new Date(start.getTime() + BOOKING_NO_SHOW_GRACE_MINUTES * 60 * 1000);
  const endsAt = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return { start, joinOpensAt, noShowDeadline, endsAt };
}

export function isBookingJoinable(
  status: string,
  scheduledAt: string | Date,
  durationMinutes: number,
  now: Date = new Date()
) {
  if (status === "completed" || status === "cancelled") return false;

  const { joinOpensAt, endsAt } = getBookingWindow(scheduledAt, durationMinutes);
  const nowMs = now.getTime();

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

    const { joinOpensAt, noShowDeadline, endsAt } = getBookingWindow(booking.scheduledAt, booking.duration);
    const candidateTimes = [joinOpensAt.getTime(), noShowDeadline.getTime(), endsAt.getTime()];

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
