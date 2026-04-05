"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isBookingJoinable } from "@/lib/bookings";

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

    async function loadReadyBooking() {
      const { data } = await supabase
        .from("bookings")
        .select("id, scheduled_at, duration, status, creator:profiles!creator_id(full_name)")
        .eq("fan_id", currentUser.id)
        .in("status", ["upcoming", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(10);

      const match = (data ?? []).find((booking: any) =>
        isBookingJoinable(booking.status, booking.scheduled_at, booking.duration)
      );

      if (!match) {
        setReadyBooking(null);
        return;
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

    const interval = window.setInterval(loadReadyBooking, 15000);
    return () => window.clearInterval(interval);
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
