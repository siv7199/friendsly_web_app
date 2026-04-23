"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { BookingList } from "@/components/creator/BookingList";
import { WeeklyAvailabilityEditor } from "@/components/creator/WeeklyAvailabilityEditor";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { deriveBookingStatus, getBookingGrossAmount, getNextAutoCancelCheckDelay, getNextBookingRefreshDelay, hasBookingEnded } from "@/lib/bookings";
import { localDateKey } from "@/lib/timezones";
import type { Booking } from "@/types";
import { getCreatorRevenueShare } from "@/lib/revenue";

function groupByDate(bookings: Booking[]) {
  const groups: Record<string, Booking[]> = {};
  for (const booking of bookings) {
    if (!groups[booking.date]) groups[booking.date] = [];
    groups[booking.date].push(booking);
  }
  return groups;
}

function formatGroupDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function CalendarPage() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  async function handleCancelBooking(booking: Booking) {
    setCancellingBookingId(booking.id);
    const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });

    if (res.ok) {
      setUpcoming((prev) => prev.filter((item) => item.id !== booking.id));
    }
    setCancellingBookingId(null);
  }

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const creatorId = user.id;
    const creatorName = user.full_name || "Creator";
    let refreshTimer: number | null = null;
    let autoCancelTimer: number | null = null;

    async function scheduleAutoCancelCheck(bookings: any[]) {
      if (autoCancelTimer) {
        window.clearTimeout(autoCancelTimer);
        autoCancelTimer = null;
      }

      const delay = getNextAutoCancelCheckDelay(
        bookings.map((booking: any) => ({
          status: booking.status,
          scheduledAt: booking.scheduled_at,
          creatorPresent: booking.creator_present,
          fanPresent: booking.fan_present,
        }))
      );

      if (delay === null) return;

      autoCancelTimer = window.setTimeout(() => {
        void loadBookings();
      }, delay);
    }

    async function loadBookings() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      const { data: packageData } = await supabase
        .from("call_packages")
        .select("id, name, duration, price, description, is_active, bookings_count")
        .eq("creator_id", creatorId)
        .order("created_at");

      setPackages(
        (packageData ?? []).map((pkg: any) => ({
          id: pkg.id,
          name: pkg.name,
          duration: pkg.duration,
          price: Number(pkg.price),
          description: pkg.description,
          isActive: pkg.is_active,
          bookingsCount: pkg.bookings_count ?? 0,
        }))
      );

      const { data } = await supabase
        .from("bookings")
        .select(`
          id, scheduled_at, duration, price, status, topic, creator_present, fan_present, late_fee_amount, late_fee_paid_at,
          fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
        `)
        .eq("creator_id", creatorId)
        .order("scheduled_at", { ascending: true });

      void scheduleAutoCancelCheck(data ?? []);

      const now = new Date();
      const expiredIds: string[] = [];

      const mappedBookings: Booking[] = (data ?? []).map((booking: any) => {
        const fan = Array.isArray(booking.fan) ? booking.fan[0] : booking.fan;
        const grossBookingAmount = getBookingGrossAmount(
          Number(booking.price),
          booking.late_fee_amount,
          booking.late_fee_paid_at
        );
        const normalizedStatus = deriveBookingStatus(
          booking.status,
          booking.scheduled_at,
          booking.duration,
          now,
          booking.creator_present,
          booking.fan_present
        );

        if (
          normalizedStatus === "completed" &&
          booking.status !== "completed" &&
          hasBookingEnded(booking.scheduled_at, booking.duration, now)
        ) {
          expiredIds.push(booking.id);
        }
        const bookingDate = new Date(booking.scheduled_at);
        return {
          id: booking.id,
          creatorId,
          creatorName,
          fanName: fan?.full_name || "Fan",
          fanUsername: fan?.username ? `@${fan.username}` : "@fan",
          fanInitials: fan?.avatar_initials ?? "F",
          fanAvatarColor: fan?.avatar_color ?? "bg-violet-600",
          fanAvatarUrl: fan?.avatar_url ?? undefined,
          date: localDateKey(bookingDate),
          time: bookingDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          duration: booking.duration,
          price: getCreatorRevenueShare(grossBookingAmount),
          status: normalizedStatus,
          topic: booking.topic || "",
        };
      });

      if (expiredIds.length > 0) {
        await supabase
          .from("bookings")
          .update({ status: "completed" })
          .in("id", expiredIds);
      }
      const nextDelay = getNextBookingRefreshDelay(
        mappedBookings.map((booking) => ({
          status: booking.status,
          scheduledAt: `${booking.date} ${booking.time}`,
          duration: booking.duration,
        })),
        now
      );
      if (nextDelay) {
        refreshTimer = window.setTimeout(() => {
          void loadBookings();
        }, nextDelay);
      }

      setUpcoming(mappedBookings.filter((booking) => booking.status === "upcoming" || booking.status === "live"));
      setCompleted(mappedBookings.filter((booking) => booking.status === "completed"));
      setLoading(false);
    }

    loadBookings();

    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      void loadBookings();
    }

    const channel = supabase
      .channel(`creator-calendar-${creatorId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `creator_id=eq.${creatorId}`,
      }, () => {
        void loadBookings();
      })
      .subscribe();

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (autoCancelTimer) window.clearTimeout(autoCancelTimer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const groupedUpcoming = groupByDate(upcoming);
  const totalUpcomingEarnings = upcoming.reduce((sum, booking) => sum + booking.price, 0);
  const totalCompletedEarnings = completed.reduce((sum, booking) => sum + booking.price, 0);

  return (
    <div className="mx-auto max-w-4xl min-w-0 space-y-5 overflow-x-hidden px-4 py-3 md:px-8">
      <div>
        <h1 className="text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">Calendar</h1>
        <p className="text-brand-ink-subtle mt-1">Your availability plus upcoming and completed sessions.</p>
      </div>

      {user && (
        <WeeklyAvailabilityEditor
          creatorId={user.id}
          packages={packages}
        />
      )}

      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Upcoming Calls", value: upcoming.length, icon: CalendarDays },
          { label: "Expected Earnings", value: formatCurrency(totalUpcomingEarnings), icon: Clock },
          { label: "Completed", value: completed.length, icon: CheckCircle2 },
          { label: "Earned (Past)", value: formatCurrency(totalCompletedEarnings), icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <Icon className="w-4 h-4 text-brand-ink-subtle mb-2" />
              <p className="text-xl font-display font-bold text-brand-ink">{item.value}</p>
              <p className="text-xs text-brand-ink-subtle mt-0.5">{item.label}</p>
            </div>
          );
        })}
      </div>

      <section className="min-w-0">
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <CalendarDays className="w-5 h-5 text-brand-info" />
          <h2 className="text-lg font-bold text-brand-ink">Upcoming</h2>
          <Badge variant="info">{upcoming.length}</Badge>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 text-center">
            <CalendarDays className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
            <p className="text-brand-ink-subtle">No upcoming bookings.</p>
            <p className="text-brand-ink-subtle text-sm mt-1">
              Your upcoming sessions will appear here as fans book you.
            </p>
          </div>
        ) : (
          Object.entries(groupedUpcoming)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, bookings]) => (
              <div key={date} className="mb-6 min-w-0">
                <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-semibold text-brand-ink-muted">
                    {formatGroupDate(date)}
                  </span>
                  <div className="h-px bg-brand-border sm:flex-1" />
                  <span className="text-xs text-brand-ink-subtle">
                    {formatCurrency(bookings.reduce((sum, booking) => sum + booking.price, 0))} expected
                  </span>
                </div>
                <BookingList
                  bookings={bookings}
                  onClickCancel={handleCancelBooking}
                  cancellingId={cancellingBookingId}
                />
              </div>
            ))
        )}
      </section>

      <section className="min-w-0">
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-brand-live" />
          <h2 className="text-lg font-bold text-brand-ink">Completed</h2>
          <Badge variant="live">{completed.length}</Badge>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
          </div>
        ) : completed.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
            <p className="text-brand-ink-subtle">No completed bookings yet.</p>
            <p className="text-brand-ink-subtle text-sm mt-1">
              Finished sessions will move here automatically.
            </p>
          </div>
        ) : (
          <BookingList bookings={completed} />
        )}
      </section>
    </div>
  );
}
