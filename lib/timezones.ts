export const COMMON_TIME_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);

  const offsetValue = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetValue.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

export function getTimeZoneAbbreviation(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);

  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    weekday: weekdays.indexOf(partMap.weekday),
  };
}

export function zonedTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}, timeZone: string) {
  const utcGuess = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  const offset = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset * 60 * 1000);
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeZoneLabel(timeZone: string) {
  const now = new Date();
  const abbreviation = getTimeZoneAbbreviation(now, timeZone);
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return `${city} (${abbreviation})`;
}

export interface WeeklyAvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

function creatorDateCandidates(viewerDates: Date[], creatorTimeZone: string) {
  const uniqueDates = new Map<string, { year: number; month: number; day: number; weekday: number }>();

  viewerDates.forEach((viewerDate) => {
    for (let offset = -1; offset <= 1; offset += 1) {
      const candidate = new Date(viewerDate);
      candidate.setHours(12, 0, 0, 0);
      candidate.setDate(candidate.getDate() + offset);
      const parts = getTimeZoneParts(candidate, creatorTimeZone);
      const key = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
      uniqueDates.set(key, {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        weekday: parts.weekday,
      });
    }
  });

  return Array.from(uniqueDates.values());
}

export function getAvailabilityWindowsForViewer(params: {
  weekDates: Date[];
  availability: WeeklyAvailabilitySlot[];
  creatorTimeZone: string;
  packageId?: string;
}) {
  const { weekDates, availability, creatorTimeZone, packageId } = params;
  const allowedAvailability = availability.filter((slot) => {
    if (!packageId) return true;
    return slot.package_id == null || slot.package_id === packageId;
  });

  const weekKeys = new Set(weekDates.map((date) => localDateKey(date)));
  const result: Record<string, string[]> = {};

  creatorDateCandidates(weekDates, creatorTimeZone).forEach((creatorDate) => {
    allowedAvailability
      .filter((slot) => slot.day_of_week === creatorDate.weekday)
      .forEach((slot) => {
        const [startHour, startMinute] = slot.start_time.split(":").map(Number);
        const [endHour, endMinute] = slot.end_time.split(":").map(Number);

        const startUtc = zonedTimeToUtc({ ...creatorDate, hour: startHour, minute: startMinute }, creatorTimeZone);
        const endUtc = zonedTimeToUtc({ ...creatorDate, hour: endHour, minute: endMinute }, creatorTimeZone);
        const key = localDateKey(startUtc);

        if (!weekKeys.has(key)) return;

        const label = `${startUtc.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${endUtc.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        result[key] = result[key] ?? [];
        if (!result[key].includes(label)) {
          result[key].push(label);
        }
      });
  });

  return result;
}

export function getAvailableStartTimesForViewerDate(params: {
  date: Date;
  availability: WeeklyAvailabilitySlot[];
  creatorTimeZone: string;
  durationMinutes: number;
  packageId?: string;
}) {
  const { date, availability, creatorTimeZone, durationMinutes, packageId } = params;
  const dateKey = localDateKey(date);
  const allowedAvailability = availability.filter((slot) => {
    if (!packageId) return true;
    return slot.package_id == null || slot.package_id === packageId;
  });

  const result = new Set<string>();

  creatorDateCandidates([date], creatorTimeZone).forEach((creatorDate) => {
    allowedAvailability
      .filter((slot) => slot.day_of_week === creatorDate.weekday)
      .forEach((slot) => {
        const [startHour, startMinute] = slot.start_time.split(":").map(Number);
        const [endHour, endMinute] = slot.end_time.split(":").map(Number);

        const startUtc = zonedTimeToUtc({ ...creatorDate, hour: startHour, minute: startMinute }, creatorTimeZone);
        const endUtc = zonedTimeToUtc({ ...creatorDate, hour: endHour, minute: endMinute }, creatorTimeZone);

        for (
          let cursor = new Date(startUtc);
          cursor.getTime() + durationMinutes * 60 * 1000 <= endUtc.getTime();
          cursor = new Date(cursor.getTime() + 30 * 60 * 1000)
        ) {
          if (localDateKey(cursor) === dateKey) {
            result.add(cursor.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
          }
        }
      });
  });

  return Array.from(result).sort((a, b) => {
    const aDate = new Date(`2000-01-01 ${a}`);
    const bDate = new Date(`2000-01-01 ${b}`);
    return aDate.getTime() - bDate.getTime();
  });
}
