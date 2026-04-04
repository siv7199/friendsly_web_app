export const BOOKING_EARLY_JOIN_MINUTES = 5;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getBookingWindow(scheduledAt: string | Date, durationMinutes: number) {
  const start = toDate(scheduledAt);
  const joinOpensAt = new Date(start.getTime() - BOOKING_EARLY_JOIN_MINUTES * 60 * 1000);
  const endsAt = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return { start, joinOpensAt, endsAt };
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

export function deriveBookingStatus(
  status: string,
  scheduledAt: string | Date,
  durationMinutes: number,
  now: Date = new Date()
) {
  if ((status === "upcoming" || status === "live") && hasBookingEnded(scheduledAt, durationMinutes, now)) {
    return "completed";
  }

  return status;
}
