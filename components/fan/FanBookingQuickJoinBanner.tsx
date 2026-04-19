"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getBookingWindow, getNextAutoCancelCheckDelay, isBookingJoinable } from "@/lib/bookings";

type ReadyBooking = {
  id: string;
  scheduledAt: string;
  duration: number;
  creatorName: string;
};

export function FanBookingQuickJoinBanner() {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const [readyBooking, setReadyBooking] = useState<ReadyBooking | null>(null);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    const supabase = createClient();
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
        void loadReadyBooking();
      }, delay);
    }

    async function loadReadyBooking() {
      if (refreshTimer) { window.clearTimeout(refreshTimer); refreshTimer = null; }

      const { data } = await supabase
        .from("bookings")
        .select("id, scheduled_at, duration, status, creator_present, fan_present, creator:profiles!creator_id(full_name)")
        .eq("fan_id", currentUser.id)
        .in("status", ["upcoming", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(10);

      const bookings = data ?? [];
      void scheduleAutoCancelCheck(bookings);
      const match = bookings.find((booking: any) =>
        isBookingJoinable(booking.status, booking.scheduled_at, booking.duration)
      );

      if (!match) {
        setReadyBooking(null);
        const nextUpcoming = bookings.find((booking: any) => booking.status === "upcoming");
        if (nextUpcoming) {
          const { joinOpensAt } = getBookingWindow(nextUpcoming.scheduled_at, nextUpcoming.duration);
          const delay = joinOpensAt.getTime() - Date.now();
          if (delay > 0) refreshTimer = window.setTimeout(loadReadyBooking, delay + 1000);
        }
        return;
      }

      const { noShowDeadline, endsAt } = getBookingWindow(match.scheduled_at, match.duration);
      const nextRefreshAt = Date.now() < noShowDeadline.getTime() ? noShowDeadline : endsAt;
      const delay = nextRefreshAt.getTime() - Date.now();
      if (delay > 0) refreshTimer = window.setTimeout(loadReadyBooking, delay + 1000);

      const creator = Array.isArray(match.creator) ? match.creator[0] : match.creator;
      setReadyBooking({
        id: match.id, scheduledAt: match.scheduled_at,
        duration: match.duration, creatorName: creator?.full_name ?? "your creator",
      });
    }

    loadReadyBooking();

    const channel = supabase.channel(`fan-bookings-banner-${currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `fan_id=eq.${currentUser.id}` },
        () => { loadReadyBooking(); })
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (autoCancelTimer) window.clearTimeout(autoCancelTimer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!readyBooking || pathname.startsWith("/room/")) return null;

  const timeLabel = new Date(readyBooking.scheduledAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });

  return (
    <div className="mx-4 md:mx-6 mt-4 rounded-2xl border border-brand-live/25 bg-brand-live/8 px-5 py-4 flex items-center justify-between gap-4 animate-slide-up">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-live">Ready to Join</p>
        <p className="mt-0.5 text-sm font-semibold text-brand-ink">
          Booking with {readyBooking.creatorName}
        </p>
        <p className="mt-0.5 text-xs text-brand-ink-muted">
          {timeLabel} · {readyBooking.duration} min
        </p>
      </div>
      <Link href={`/room/${readyBooking.id}`}>
        <Button variant="live" size="sm" className="gap-1.5 shrink-0">
          <Video className="w-3.5 h-3.5" />
          Join Now
        </Button>
      </Link>
    </div>
  );
}
