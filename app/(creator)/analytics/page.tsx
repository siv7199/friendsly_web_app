"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Loader2, MousePointerClick, TrendingUp, Users, Video } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AnalyticsRangeKey, getCreatorAnalyticsSnapshot } from "@/lib/analytics";

const RANGE_OPTIONS: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

export default function AnalyticsPage() {
  const { user } = useAuthContext();
  const [range, setRange] = useState<AnalyticsRangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [profileViews, setProfileViews] = useState(0);
  const [uniqueViewers, setUniqueViewers] = useState(0);
  const [bookingsCreated, setBookingsCreated] = useState(0);
  const [uniqueConverters, setUniqueConverters] = useState(0);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [liveQueueJoins, setLiveQueueJoins] = useState(0);
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [dailySeries, setDailySeries] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;

    async function loadAnalytics() {
      setLoading(true);
      const snapshot = await getCreatorAnalyticsSnapshot(currentUser.id, range);
      setProfileViews(snapshot.profileViews);
      setUniqueViewers(snapshot.uniqueViewers);
      setBookingsCreated(snapshot.bookingsCreated);
      setUniqueConverters(snapshot.uniqueConverters);
      setCompletedCalls(snapshot.completedCalls);
      setLiveQueueJoins(snapshot.liveQueueJoins);
      setGrossRevenue(snapshot.creatorRevenue);
      setDailySeries(snapshot.dailySeries);
      setLoading(false);
    }

    loadAnalytics();
  }, [range, user]);

  const conversionRate = useMemo(() => {
    const base = uniqueViewers > 0 ? uniqueViewers : profileViews;
    if (base === 0) return 0;
    return Math.min(100, Math.round((uniqueConverters / base) * 1000) / 10);
  }, [profileViews, uniqueConverters, uniqueViewers]);

  const maxBar = useMemo(() => {
    return Math.max(1, ...dailySeries.map((point) => Math.max(point.views, point.bookings, point.liveJoins)));
  }, [dailySeries]);

  return (
    <div className="px-4 md:px-8 py-3 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">Analytics</h1>
          <p className="text-brand-ink-subtle mt-1">Track profile views, conversion, bookings, and public live guest interest.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              className={option.key === range
                ? "px-3 py-2 rounded-xl bg-brand-primary/20 border border-brand-primary/30 text-sm font-medium text-brand-primary-light"
                : "px-3 py-2 rounded-xl bg-brand-surface border border-brand-border text-sm font-medium text-brand-ink-subtle hover:text-brand-ink"}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 flex justify-center">
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Profile Views", value: profileViews.toLocaleString(), icon: MousePointerClick },
              { label: "Bookings Created", value: bookingsCreated.toLocaleString(), icon: CalendarDays },
              { label: "Live Queue Joins", value: liveQueueJoins.toLocaleString(), icon: Users },
              { label: "Completed Calls", value: completedCalls.toLocaleString(), icon: Video },
              { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                  <Icon className="w-5 h-5 text-brand-primary-light mb-3" />
                  <p className="text-2xl font-display font-bold text-brand-ink">{item.value}</p>
                  <p className="text-xs text-brand-ink-subtle mt-1">{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="w-5 h-5 text-brand-info" />
                <h2 className="text-lg font-bold text-brand-ink">Traffic And Conversion Trend</h2>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(28px,1fr))] gap-3 items-end min-h-[220px]">
                {dailySeries.map((point) => (
                  <div key={point.label} className="flex flex-col items-center gap-2">
                    <div className="h-40 w-full flex items-end justify-center gap-1">
                      <div className="w-2 rounded-full bg-brand-info/70" style={{ height: `${Math.max(8, (point.views / maxBar) * 100)}%` }} />
                      <div className="w-2 rounded-full bg-brand-primary/80" style={{ height: `${Math.max(8, (point.bookings / maxBar) * 100)}%` }} />
                      <div className="w-2 rounded-full bg-brand-live/80" style={{ height: `${Math.max(8, (point.liveJoins / maxBar) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-brand-ink-subtle text-center">{point.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-brand-ink-subtle flex-wrap">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-brand-info/70" />Views</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-brand-primary/80" />Bookings</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-brand-live/80" />Live joins</span>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-brand-ink">Performance Snapshot</h2>
                <p className="text-sm text-brand-ink-subtle mt-1">A practical read on how your funnel is doing.</p>
              </div>

              <div className="rounded-xl border border-brand-border bg-brand-elevated p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-ink-subtle">Conversion</p>
                <p className="text-3xl font-display font-bold text-brand-ink mt-2">{conversionRate}%</p>
                <p className="text-sm text-brand-ink-subtle mt-2">
                  {uniqueConverters} unique converters from {uniqueViewers > 0 ? uniqueViewers : profileViews} viewers.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-brand-elevated p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-ink-subtle">Creator Revenue</p>
                <p className="text-3xl font-display font-bold text-brand-ink mt-2">{formatCurrency(grossRevenue)}</p>
                <p className="text-sm text-brand-ink-subtle mt-2">
                  Includes completed booking sessions and paid live guest turns in the selected range.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
