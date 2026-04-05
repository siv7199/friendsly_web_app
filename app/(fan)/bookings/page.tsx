"use client";

/**
 * Fan Bookings Page  (route: /bookings)
 *
 * Shows the logged-in fan's bookings: upcoming, completed, and cancelled.
 * All data comes from the Supabase `bookings` table.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Clock, Video, XCircle,
  Loader2, Compass, MessageSquare,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { deriveBookingStatus, hasBookingEnded, isBookingJoinable } from "@/lib/bookings";

type Tab = "upcoming" | "completed" | "cancelled";

interface FanBooking {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  scheduledAt: string;
  duration: number;
  price: number;
  status: string;
  topic?: string;
  packageName?: string;
}

export default function BookingsPage() {
  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<FanBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from("bookings")
      .select(
        `id, scheduled_at, duration, price, status, topic,
         creator:profiles!creator_id(id, full_name, username, avatar_initials, avatar_color, avatar_url),
         package:call_packages!package_id(name)`
      )
      .eq("fan_id", user.id)
      .order("scheduled_at", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async ({ data }: { data: any[] | null }) => {
        if (data) {
          const now = new Date();
          const expiredIds: string[] = [];

          setBookings(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.map((b: any) => {
              const creator = Array.isArray(b.creator) ? b.creator[0] : b.creator;
              const pkg = Array.isArray(b.package) ? b.package[0] : b.package;
              const nextStatus = deriveBookingStatus(b.status, b.scheduled_at, b.duration, now);

              if (nextStatus === "completed" && b.status !== "completed" && hasBookingEnded(b.scheduled_at, b.duration, now)) {
                expiredIds.push(b.id);
              }

              return {
                id: b.id,
                creatorId: (creator as { id: string })?.id ?? "",
                creatorName: (creator as { full_name: string })?.full_name ?? "Creator",
                creatorUsername: (creator as { username: string })?.username ?? "",
                creatorInitials: (creator as { avatar_initials: string })?.avatar_initials ?? "?",
                creatorColor: (creator as { avatar_color: string })?.avatar_color ?? "bg-violet-600",
                creatorAvatarUrl: (creator as { avatar_url: string })?.avatar_url ?? undefined,
                scheduledAt: b.scheduled_at,
                duration: b.duration,
                price: Number(b.price),
                status: nextStatus,
                topic: b.topic ?? undefined,
                packageName: (pkg as { name: string })?.name ?? undefined,
              };
            })
          );

          if (expiredIds.length > 0) {
            await supabase
              .from("bookings")
              .update({ status: "completed" })
              .in("id", expiredIds);
          }
        }
        setLoading(false);
      });
  }, [user]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    const supabase = createClient();
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
    );
    setCancellingId(null);
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: "Upcoming", count: bookings.filter((b) => b.status === "upcoming" || b.status === "live").length },
    { key: "completed", label: "Completed", count: bookings.filter((b) => b.status === "completed").length },
    { key: "cancelled", label: "Cancelled", count: bookings.filter((b) => b.status === "cancelled").length },
  ];

  const filtered = bookings.filter((b) => {
    if (activeTab === "upcoming") {
      return b.status === "upcoming" || b.status === "live";
    }

    return b.status === activeTab;
  });
  const nextJoinableBooking = bookings.find((b) => isBookingJoinable(b.status, b.scheduledAt, b.duration));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-100">My Bookings</h1>
        <p className="text-slate-400 mt-1">Manage your upcoming and past sessions.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-brand-surface border border-brand-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-brand-primary/20 text-brand-primary-light border border-brand-primary/20"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "ml-2 text-xs px-1.5 py-0.5 rounded-full",
                activeTab === tab.key
                  ? "bg-brand-primary/30 text-brand-primary-light"
                  : "bg-brand-elevated text-slate-500"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {nextJoinableBooking && (
        <div className="rounded-2xl border border-brand-live/30 bg-brand-live/10 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">Ready To Join</p>
            <p className="mt-1 text-sm text-slate-100">
              Your booking with {nextJoinableBooking.creatorName} is ready now.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(nextJoinableBooking.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {nextJoinableBooking.duration} min
            </p>
          </div>
          <Link href={`/room/${nextJoinableBooking.id}`}>
            <Button variant="live" className="gap-2 shadow-glow-live">
              <Video className="w-4 h-4" />
              Quick Join
            </Button>
          </Link>
        </div>
      )}

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
          {activeTab === "upcoming" ? (
            <>
              <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-300">No upcoming bookings</p>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Find a creator and book your first 1-on-1 call!
              </p>
              <Link href="/discover">
                <Button variant="primary" size="md" className="gap-2">
                  <Compass className="w-4 h-4" />
                  Discover Creators
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Video className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-300">
                No {activeTab} bookings
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {activeTab === "completed"
                  ? "Your completed sessions will appear here."
                  : "Cancelled sessions will appear here."}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const bookingDate = new Date(booking.scheduledAt);
            const dateStr = bookingDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeStr = bookingDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });

            const isJoinable = isBookingJoinable(booking.status, booking.scheduledAt, booking.duration);

            return (
              <div
                key={booking.id}
                className="rounded-2xl border border-brand-border bg-brand-surface p-5 hover:border-brand-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <Link href={`/profile/${booking.creatorId}`}>
                    <Avatar
                      initials={booking.creatorInitials}
                      color={booking.creatorColor}
                      size="md"
                      imageUrl={booking.creatorAvatarUrl}
                      className="cursor-pointer"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/profile/${booking.creatorId}`}
                          className="font-bold text-slate-100 hover:text-brand-primary-light transition-colors"
                        >
                          {booking.creatorName}
                        </Link>
                        <p className="text-sm text-slate-500">@{booking.creatorUsername}</p>
                      </div>
                      <Badge
                        variant={
                          booking.status === "upcoming" || booking.status === "live"
                            ? "primary"
                            : booking.status === "completed"
                            ? "default"
                            : "default"
                        }
                        className={cn(
                          "shrink-0 text-[11px]",
                          booking.status === "cancelled" && "opacity-50"
                        )}
                      >
                        {booking.status === "upcoming" && "Upcoming"}
                        {booking.status === "live" && "Live Now"}
                        {booking.status === "completed" && "✓ Completed"}
                        {booking.status === "cancelled" && "Cancelled"}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {dateStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {timeStr} · {booking.duration} min
                      </span>
                      <span className="font-semibold text-slate-200">
                        {formatCurrency(booking.price)}
                      </span>
                    </div>

                    {booking.packageName && (
                      <p className="text-xs text-slate-500 mt-1">
                        Package: {booking.packageName}
                      </p>
                    )}

                    {booking.topic && (
                      <div className="mt-2 flex items-start gap-1.5 text-sm text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{booking.topic}</span>
                      </div>
                    )}

                    {/* Actions */}
                    {(booking.status === "upcoming" || booking.status === "live") && (
                      <div className="flex gap-2 mt-3">
                        {booking.status === "upcoming" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(booking.id)}
                            disabled={cancellingId === booking.id}
                            className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {cancellingId === booking.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        )}
                        {isJoinable && (
                          <Link href={`/room/${booking.id}`}>
                            <Button
                              variant="live"
                              size="sm"
                              className="gap-1.5 shadow-glow-live"
                            >
                              <Video className="w-3.5 h-3.5" />
                              {booking.status === "live" ? "JOIN LIVE ROOM" : "JOIN CALL"}
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
