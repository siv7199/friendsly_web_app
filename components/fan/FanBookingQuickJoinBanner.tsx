"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getBookingWindow, isBookingJoinable } from "@/lib/bookings";

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

    async function loadReadyBooking() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      await fetch("/api/bookings/auto-cancel", { method: "POST" }).catch(() => null);

      const { data } = await supabase
        .from("bookings")
        .select("id, scheduled_at, duration, status, creator:profiles!creator_id(full_name)")
        .eq("fan_id", currentUser.id)
        .in("status", ["upcoming", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(10);

      const bookings = data ?? [];
      const match = bookings.find((booking: any) =>
        isBookingJoinable(booking.status, booking.scheduled_at, booking.duration)
      );

      if (!match) {
        setReadyBooking(null);
        const nextUpcoming = bookings.find((booking: any) => booking.status === "upcoming");
        if (nextUpcoming) {
          const { joinOpensAt } = getBookingWindow(nextUpcoming.scheduled_at, nextUpcoming.duration);
          const delay = joinOpensAt.getTime() - Date.now();
          if (delay > 0) {
            refreshTimer = window.setTimeout(loadReadyBooking, delay + 1000);
          }
        }
        return;
      }

      const { noShowDeadline, endsAt } = getBookingWindow(match.scheduled_at, match.duration);
      const nextRefreshAt = Date.now() < noShowDeadline.getTime() ? noShowDeadline : endsAt;
      const delay = nextRefreshAt.getTime() - Date.now();
      if (delay > 0) {
        refreshTimer = window.setTimeout(loadReadyBooking, delay + 1000);
      }

      const creator = Array.isArray(match.creator) ? match.creator[0] : match.creator;
      setReadyBooking({
        id: match.id,
        scheduledAt: match.scheduled_at,
        duration: match.duration,
        creatorName: creator?.full_name ?? "your creator",
      });
    }

    loadReadyBooking();

    const channel = supabase
      .channel(`fan-bookings-banner-${currentUser.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `fan_id=eq.${currentUser.id}`,
      }, () => {
        loadReadyBooking();
      })
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!readyBooking || pathname.startsWith("/room/")) {
    return null;
  }

  const timeLabel = new Date(readyBooking.scheduledAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-4 md:mx-8 mt-4 rounded-2xl border border-brand-live/30 bg-brand-live/10 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">Ready To Join</p>
        <p className="mt-1 text-sm text-slate-100">
          Your booking with {readyBooking.creatorName} is ready now.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {timeLabel} · {readyBooking.duration} min
        </p>
      </div>
      <Link href={`/room/${readyBooking.id}`}>
        <Button variant="live" className="gap-2 shadow-glow-live">
          <Video className="w-4 h-4" />
          Quick Join
        </Button>
      </Link>
    </div>
  );
}
