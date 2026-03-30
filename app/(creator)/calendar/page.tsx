"use client";

/**
 * Calendar Page  (route: /calendar)
 *
 * Shows upcoming and completed bookings in a structured view.
 * Only the seeded demo creator (id "1") sees mock bookings.
 * Real signed-up creators see empty states.
 */

import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { BookingList } from "@/components/creator/BookingList";
import { Badge } from "@/components/ui/badge";
import { MOCK_BOOKINGS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import type { Booking } from "@/types";

function groupByDate(bookings: Booking[]) {
  const groups: Record<string, Booking[]> = {};
  for (const b of bookings) {
    if (!groups[b.date]) groups[b.date] = [];
    groups[b.date].push(b);
  }
  return groups;
}

function formatGroupDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function CalendarPage() {
  const { user } = useAuthContext();
  const isDemo = user?.id === "1";

  const upcoming = isDemo ? MOCK_BOOKINGS.filter((b) => b.status === "upcoming") : [];
  const completed = isDemo ? MOCK_BOOKINGS.filter((b) => b.status === "completed") : [];
  const groupedUpcoming = groupByDate(upcoming);

  const totalUpcomingEarnings = upcoming.reduce((s, b) => s + b.price, 0);
  const totalCompletedEarnings = completed.reduce((s, b) => s + b.price, 0);

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-slate-100">Calendar</h1>
        <p className="text-slate-400 mt-1">Your upcoming and completed sessions.</p>
      </div>

      {/* ── Overview strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Upcoming Calls",
            value: upcoming.length,
            icon: CalendarDays,
          },
          {
            label: "Expected Earnings",
            value: formatCurrency(totalUpcomingEarnings),
            icon: Clock,
          },
          {
            label: "Completed",
            value: completed.length,
            icon: CheckCircle2,
          },
          {
            label: "Earned (Past)",
            value: formatCurrency(totalCompletedEarnings),
            icon: CheckCircle2,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-brand-border bg-brand-surface p-4"
            >
              <Icon className="w-4 h-4 text-slate-400 mb-2" />
              <p className="text-xl font-black text-slate-100">{item.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Upcoming section ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-brand-info" />
          <h2 className="text-lg font-bold text-slate-100">Upcoming</h2>
          <Badge variant="info">{upcoming.length}</Badge>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 text-center">
            <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No upcoming bookings.</p>
            <p className="text-slate-500 text-sm mt-1">
              Share your profile link to get your first booking!
            </p>
          </div>
        ) : (
          Object.entries(groupedUpcoming)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, bookings]) => (
              <div key={date} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-slate-300">
                    {formatGroupDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-brand-border" />
                  <span className="text-xs text-slate-500">
                    {formatCurrency(bookings.reduce((s, b) => s + b.price, 0))} expected
                  </span>
                </div>
                <BookingList bookings={bookings} />
              </div>
            ))
        )}
      </section>

      {/* ── Completed section ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-brand-live" />
          <h2 className="text-lg font-bold text-slate-100">Completed</h2>
          <Badge variant="live">{completed.length}</Badge>
        </div>
        <BookingList bookings={completed} />
      </section>
    </div>
  );
}
