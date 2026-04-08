"use client";

/**
 * Creator Dashboard  (route: /dashboard)
 *
 * The creator's home base — stats overview + recent bookings.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Video, Star, Calendar,
  Users, TrendingUp, Radio, ArrowRight, Loader2,
} from "lucide-react";
import { StatsCard } from "@/components/creator/StatsCard";
import { BookingList } from "@/components/creator/BookingList";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CREATOR_STATS, MOCK_BOOKINGS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import type { CreatorStats } from "@/types";
import { getCreatorPackages } from "@/lib/mock-auth";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { deriveBookingStatus, getBookingWindow, hasBookingEnded, isBookingJoinable } from "@/lib/bookings";
import { getCreatorAnalyticsSnapshot } from "@/lib/analytics";

interface DashReview {
  id: string;
  fanName: string;
  fanInitials: string;
  fanColor: string;
  fanAvatarUrl?: string;
  rating: number;
  comment: string;
  date: string;
}

const EMPTY_STATS: CreatorStats = {
  totalEarnings: 0,
  callsThisMonth: 0,
  avgRating: 0,
  upcomingBookings: 0,
  totalFans: 0,
  conversionRate: 0,
};

export default function DashboardPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [dashReviews, setDashReviews] = useState<DashReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [stats, setStats] = useState<CreatorStats>(EMPTY_STATS);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [nextJoinableBooking, setNextJoinableBooking] = useState<any | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  async function handleCancelBooking(booking: any) {
    const bookingId = booking.id;
    setCancellingBookingId(bookingId);
    const supabase = createClient();
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    setUpcomingBookings((prev: any[]) => prev.filter((booking) => booking.id !== bookingId));
    setStats((prev) => ({
      ...prev,
      upcomingBookings: Math.max(0, prev.upcomingBookings - 1),
    }));
    if (nextJoinableBooking?.id === bookingId) {
      setNextJoinableBooking(null);
    }
    setCancellingBookingId(null);
  }

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const creatorName = user.full_name || "Creator";
    const supabase = createClient();
    let refreshTimer: number | null = null;
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, fan:profiles!fan_id(full_name, avatar_initials, avatar_color, avatar_url)")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setDashReviews(data.map((r: any) => {
            const fan = Array.isArray(r.fan) ? r.fan[0] : r.fan;
            return {
              id: r.id,
              fanName: fan?.full_name ?? "Fan",
              fanInitials: fan?.avatar_initials ?? "F",
              fanColor: fan?.avatar_color ?? "bg-violet-600",
              fanAvatarUrl: fan?.avatar_url ?? undefined,
              rating: r.rating,
              comment: r.comment ?? "",
              date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            };
          }));
        }
        setLoadingReviews(false);
      });

    // ── Load Bookings & Compute Stats ──
    async function loadDashboard() {
      // 1. Fetch bookings, live queue joins, profile views, and raw reviews
      const [bookingsRes, liveRes, reviewsRes, analyticsSnapshot] = await Promise.all([
        supabase
          .from("bookings")
          .select(`
            id, scheduled_at, duration, price, status, topic,
            fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
          `)
          .eq("creator_id", userId)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("live_sessions")
          .select("id, live_queue_entries(id, status, amount_charged, ended_at)")
          .eq("creator_id", userId),
        supabase
          .from("reviews")
          .select("rating")
          .eq("creator_id", userId),
        getCreatorAnalyticsSnapshot(userId, "month"),
      ]);

      const bookings = bookingsRes.data || [];
      const expiredBookingIds: string[] = [];
      
      let totalEarnedGross = 0;
      let callsMonth = 0;
      let upcomingCount = 0;
      let totalBookings = 0;
      const uniqueFans = new Set<string>();
      const now = new Date();

      const nextSevenDays = new Date(now);
      nextSevenDays.setDate(now.getDate() + 7);

      const mappedBookings = bookings.map((b: any) => {
        const fan = Array.isArray(b.fan) ? b.fan[0] : b.fan;
        const normalizedStatus = deriveBookingStatus(b.status, b.scheduled_at, b.duration, now);

        if (normalizedStatus === "completed" && b.status !== "completed" && hasBookingEnded(b.scheduled_at, b.duration, now)) {
          expiredBookingIds.push(b.id);
        }
        
        if (normalizedStatus === "completed" || normalizedStatus === "upcoming" || normalizedStatus === "live") {
          totalEarnedGross += Number(b.price);
          totalBookings++; // To be used in conversion rate
        }

        const bDate = new Date(b.scheduled_at);
        if (
          normalizedStatus === "completed" &&
          bDate.getMonth() === now.getMonth() &&
          bDate.getFullYear() === now.getFullYear()
        ) {
          callsMonth++;
        }

        if (
          (normalizedStatus === "upcoming" || normalizedStatus === "live") &&
          bDate >= now &&
          bDate <= nextSevenDays
        ) {
          upcomingCount++;
        }
        if (fan) uniqueFans.add(fan.username);

        return {
          id: b.id,
          creatorId: userId,
          creatorName,
          fanName: fan?.full_name || "Fan",
          fanUsername: fan?.username ? `@${fan.username}` : "@fan",
          fanInitials: fan?.avatar_initials ?? "F",
          fanAvatarColor: fan?.avatar_color ?? "bg-violet-600",
          fanAvatarUrl: fan?.avatar_url ?? undefined,
          scheduledAt: b.scheduled_at,
          date: bDate.toISOString().split("T")[0],
          time: bDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          duration: b.duration,
          price: Number(b.price) * 0.85, // Show their 85% cut!
          status: normalizedStatus,
          topic: b.topic || ""
        };
      });

      if (expiredBookingIds.length > 0) {
        await supabase
          .from("bookings")
          .update({ status: "completed" })
          .in("id", expiredBookingIds);
      }

      const upcoming = mappedBookings.filter((b: any) => b.status === "upcoming" || b.status === "live");
      setUpcomingBookings(upcoming);
      setNextJoinableBooking(
        mappedBookings.find((b: any) => isBookingJoinable(b.status, b.scheduledAt, b.duration)) ?? null
      );
      const nextUpcomingBooking = mappedBookings.find((b: any) => b.status === "upcoming");
      if (nextUpcomingBooking) {
        const { joinOpensAt } = getBookingWindow(nextUpcomingBooking.scheduledAt, nextUpcomingBooking.duration);
        const delay = joinOpensAt.getTime() - Date.now();
        if (delay > 0) {
          refreshTimer = window.setTimeout(loadDashboard, delay + 1000);
        }
      }

      let totalLiveJoins = 0;
      let liveQueueEarned = 0;
      if (liveRes.data) {
        liveRes.data.forEach((session: any) => {
          totalLiveJoins += (session.live_queue_entries?.length || 0);
          
          // Sum up amount_charged from each queue entry
          if (Array.isArray(session.live_queue_entries)) {
            session.live_queue_entries.forEach((entry: any) => {
              if ((entry.status === "completed" || entry.status === "skipped") && entry.amount_charged) {
                liveQueueEarned += Number(entry.amount_charged);
              }
              if ((entry.status === "completed" || entry.status === "skipped") && entry.amount_charged) {
                const endedAt = entry.ended_at ? new Date(entry.ended_at) : null;
                if (endedAt && endedAt.getMonth() === now.getMonth() && endedAt.getFullYear() === now.getFullYear()) {
                  callsMonth++;
                }
              }
            });
          }
        });
      }
      
      const creatorCut = (totalEarnedGross + liveQueueEarned) * 0.85;
      
      // Calculate Average Rating dynamically
      const allReviews = reviewsRes.data || [];
      let calculatedAvgRating = 0;
      if (allReviews.length > 0) {
        const sum = allReviews.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
        calculatedAvgRating = Math.round((sum / allReviews.length) * 10) / 10;
      }

      setStats({
        totalEarnings: creatorCut,
        callsThisMonth: callsMonth,
        avgRating: calculatedAvgRating,
        reviewCount: allReviews.length,
        upcomingBookings: upcomingCount,
        totalFans: uniqueFans.size,
        conversionRate: analyticsSnapshot.conversionRate
      });

      setLoadingDashboard(false);
    }
    loadDashboard();

    const channel = supabase
      .channel(`creator-dashboard-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `creator_id=eq.${userId}`,
      }, () => {
        loadDashboard();
      })
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const displayName = user?.full_name ?? "Creator";
  const displayUsername = user ? `@${user.username}` : "";
  const displayCategory = user && isCreatorProfile(user) ? user.category : "";
  const avatarInitials = user?.avatar_initials ?? "??";
  const avatarColor = user?.avatar_color ?? "bg-violet-600";
  const avatarUrl = user?.avatar_url ?? undefined;

  // Calculate profile completeness score
  const profileStrength = (() => {
    if (!user) return 0;
    let score = 0;
    if (user.full_name) score += 20;
    if (user.username) score += 10;
    if (user.avatar_color) score += 5;
    if (user.avatar_url) score += 15;
    if (isCreatorProfile(user)) {
      if (user.bio) score += 25;
      if (user.category) score += 15;
      const pkgs = getCreatorPackages(user.id);
      if (pkgs.some((p) => p.isActive)) score += 10;
    }
    return score;
  })();

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-8">
      {/* ── Status Banner ── */}
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">Good afternoon,</p>
          <h1 className="text-3xl font-black text-slate-100">{displayName} 👋</h1>
        </div>
        <Link href="/live">
          <Button variant="live" className="gap-2 shadow-glow-live">
            <Radio className="w-4 h-4" />
            Go Live
          </Button>
        </Link>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="Total Earnings"
          value={formatCurrency(stats.totalEarnings)}
          subtext="All time"
          icon={<DollarSign className="w-5 h-5" />}
          accent="gold"
          className="col-span-2 xl:col-span-2"
        />
        <StatsCard
          title="Calls This Month"
          value={String(stats.callsThisMonth)}
          subtext={new Date().toLocaleString("default", { month: "long", year: "numeric" })}
          icon={<Video className="w-5 h-5" />}
          accent="primary"
        />
        <StatsCard
          title="Avg. Rating"
          value={stats.avgRating > 0 ? String(stats.avgRating) : "—"}
          subtext={stats.reviewCount ? `From ${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"}` : "No reviews yet"}
          icon={<Star className="w-5 h-5" />}
          accent="gold"
        />
        <StatsCard
          title="Upcoming"
          value={String(stats.upcomingBookings)}
          subtext="Next 7 days"
          icon={<Calendar className="w-5 h-5" />}
          accent="info"
        />
        <StatsCard
          title="Conversion"
          value={`${stats.conversionRate}%`}
          subtext="View → book rate"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="live"
          onClick={() => router.push("/analytics")}
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          {nextJoinableBooking && (
            <div className="mb-4 rounded-2xl border border-brand-live/30 bg-brand-live/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">Ready To Start</p>
                <p className="mt-1 text-sm text-slate-100">
                  {nextJoinableBooking.status === "live" ? "Your booking room is live now." : `You can join ${nextJoinableBooking.fanName}'s booking now.`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {nextJoinableBooking.time} · {nextJoinableBooking.duration} min
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

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-100">Upcoming Bookings</h2>
            <Link href="/calendar" className="text-sm text-brand-primary-light hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loadingDashboard ? (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 flex justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <BookingList
              bookings={upcomingBookings}
              onClickCancel={handleCancelBooking}
              cancellingId={cancellingBookingId}
            />
          )}
        </div>

        {/* Quick actions + profile card */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={avatarInitials} color={avatarColor} imageUrl={avatarUrl} size="md" />
              <div>
                <p className="font-bold text-slate-100">{displayName}</p>
                <p className="text-xs text-slate-500">
                  {displayUsername}{displayCategory ? ` · ${displayCategory}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Profile strength</span>
                <span className="text-brand-live font-semibold">{profileStrength}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-brand-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-live transition-all"
                  style={{ width: `${profileStrength}%` }}
                />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-brand-elevated border border-brand-border text-xs text-slate-400">
              💡 Add a profile video to increase bookings by up to 30%.
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Manage Offerings", href: "/management", icon: "⚙️" },
                { label: "View Calendar", href: "/calendar", icon: "📅" },
                { label: "Update Availability", href: "/management", icon: "🕐" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-elevated border border-brand-border hover:border-brand-primary/40 transition-colors text-sm text-slate-300 hover:text-slate-100"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Reviews ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-100">Recent Reviews</h2>
        </div>
        {loadingReviews ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 flex justify-center">
            <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
          </div>
        ) : dashReviews.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
            <Star className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No reviews yet.</p>
            <p className="text-slate-500 text-sm mt-1">Reviews from fans will appear here after their calls.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashReviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                <div className="flex items-start gap-3">
                  <Avatar initials={review.fanInitials} color={review.fanColor} imageUrl={review.fanAvatarUrl} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-100">{review.fanName}</p>
                      <span className="text-xs text-slate-500">{review.date}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "w-3.5 h-3.5",
                            n <= review.rating
                              ? "fill-brand-gold text-brand-gold"
                              : "text-slate-600"
                          )}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-slate-300 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
