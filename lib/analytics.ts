import { createClient } from "@/lib/supabase/client";
import { deriveBookingStatus, hasBookingEnded } from "@/lib/bookings";

export type AnalyticsRangeKey = "7d" | "30d" | "month";

export type DailyAnalyticsPoint = {
  key: string;
  label: string;
  views: number;
  bookings: number;
  liveJoins: number;
};

export type CreatorAnalyticsSnapshot = {
  profileViews: number;
  uniqueViewers: number;
  bookingsCreated: number;
  uniqueConverters: number;
  completedCalls: number;
  liveQueueJoins: number;
  creatorRevenue: number;
  conversionRate: number;
  dailySeries: DailyAnalyticsPoint[];
};

export function getAnalyticsRangeStart(range: AnalyticsRangeKey) {
  const now = new Date();
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now);
  start.setDate(now.getDate() - (range === "7d" ? 6 : 29));
  start.setHours(0, 0, 0, 0);
  return start;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getCreatorAnalyticsSnapshot(creatorId: string, range: AnalyticsRangeKey): Promise<CreatorAnalyticsSnapshot> {
  const supabase = createClient();
  const startDate = getAnalyticsRangeStart(range);
  const now = new Date();

  const [viewsRes, bookingsRes, liveRes] = await Promise.all([
    supabase
      .from("creator_profile_view_events")
      .select("viewed_at, viewer_id")
      .eq("creator_id", creatorId)
      .gte("viewed_at", startDate.toISOString()),
    supabase
      .from("bookings")
      .select("id, created_at, scheduled_at, duration, status, price, fan_id")
      .eq("creator_id", creatorId)
      .gte("created_at", startDate.toISOString()),
    supabase
      .from("live_sessions")
      .select("id, live_queue_entries(id, fan_id, joined_at, ended_at, status, amount_charged)")
      .eq("creator_id", creatorId),
  ]);

  const dailyMap = new Map<string, DailyAnalyticsPoint>();
  for (let cursor = new Date(startDate); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
    const key = dayKey(cursor);
    dailyMap.set(key, {
      key,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: 0,
      bookings: 0,
      liveJoins: 0,
    });
  }

  const views = viewsRes.data || [];
  views.forEach((view: any) => {
    const viewedAt = new Date(view.viewed_at);
    const point = dailyMap.get(dayKey(viewedAt));
    if (point) point.views += 1;
  });

  const uniqueViewers = new Set(
    views.map((view: any) => view.viewer_id).filter(Boolean)
  ).size;
  const uniqueConverters = new Set<string>();

  let completedCalls = 0;
  let creatorRevenue = 0;
  const bookings = bookingsRes.data || [];
  bookings.forEach((booking: any) => {
    const createdAt = new Date(booking.created_at);
    const point = dailyMap.get(dayKey(createdAt));
    if (point) point.bookings += 1;
    if (booking.fan_id) {
      uniqueConverters.add(String(booking.fan_id));
    }

    const normalizedStatus = deriveBookingStatus(booking.status, booking.scheduled_at, booking.duration, now);
    if (normalizedStatus === "completed" && hasBookingEnded(booking.scheduled_at, booking.duration, now)) {
      completedCalls += 1;
      creatorRevenue += Number(booking.price ?? 0) * 0.85;
    }
  });

  let liveQueueJoins = 0;
  (liveRes.data || []).forEach((session: any) => {
    (session.live_queue_entries || []).forEach((entry: any) => {
      const joinedAt = entry.joined_at ? new Date(entry.joined_at) : null;
      if (!joinedAt || joinedAt < startDate) return;

      liveQueueJoins += 1;
      if (entry.fan_id) {
        uniqueConverters.add(String(entry.fan_id));
      }
      const point = dailyMap.get(dayKey(joinedAt));
      if (point) point.liveJoins += 1;

      if ((entry.status === "completed" || entry.status === "skipped") && entry.amount_charged) {
        completedCalls += 1;
        creatorRevenue += Number(entry.amount_charged) * 0.85;
      }
    });
  });

  const profileViews = views.length;
  const bookingsCreated = bookings.length;
  const conversionBase = uniqueViewers > 0 ? uniqueViewers : profileViews;
  const conversionRate = conversionBase > 0
    ? Math.min(100, Math.round(((uniqueConverters.size / conversionBase) * 100) * 10) / 10)
    : 0;

  return {
    profileViews,
    uniqueViewers,
    bookingsCreated,
    uniqueConverters: uniqueConverters.size,
    completedCalls,
    liveQueueJoins,
    creatorRevenue,
    conversionRate,
    dailySeries: Array.from(dailyMap.values()),
  };
}
