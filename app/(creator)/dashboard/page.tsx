"use client";

/**
 * Creator Dashboard  (route: /dashboard)
 *
 * The creator's home base — stats overview + recent bookings.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Video, Star, Calendar,
  Users, TrendingUp, Radio, ArrowRight, Loader2, Sparkles,
} from "lucide-react";
import { StatsCard } from "@/components/creator/StatsCard";
import { BookingList } from "@/components/creator/BookingList";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CREATOR_STATS, MOCK_BOOKINGS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import type { CreatorProfile, CreatorStats } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { deriveBookingStatus, getBookingGrossAmount, getNextAutoCancelCheckDelay, getNextBookingRefreshDelay, hasBookingEnded, isBookingJoinable } from "@/lib/bookings";
import { getCreatorAnalyticsSnapshot } from "@/lib/analytics";
import { getCreatorInsights, type CreatorInsight } from "@/lib/creator-insights";
import { localDateKey } from "@/lib/timezones";
import { getCreatorLiveConsolePath } from "@/lib/routes";

interface LiveRequestRow {
  id: string;
  fanName: string;
  fanUsername: string;
  fanInitials: string;
  fanAvatarColor: string;
  fanAvatarUrl?: string;
  requestedAt: string;
}

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

function creatorProfileFromRow(row: any): CreatorProfile | null {
  if (!row || row.role !== "creator") return null;

  const creatorProfile = Array.isArray(row.creator_profiles)
    ? row.creator_profiles[0]
    : row.creator_profiles;

  return {
    id: row.id,
    email: row.email ?? "",
    full_name: row.full_name ?? "",
    username: row.username ?? "",
    avatar_initials: row.avatar_initials ?? "?",
    avatar_color: row.avatar_color ?? "bg-violet-600",
    avatar_url: row.avatar_url ?? undefined,
    created_at: row.created_at ?? "",
    role: "creator",
    bio: creatorProfile?.bio ?? "",
    hourly_rate: 0,
    category: creatorProfile?.category ?? "",
    is_live: creatorProfile?.is_live ?? false,
    live_join_fee: creatorProfile?.live_join_fee ? Number(creatorProfile.live_join_fee) : undefined,
    instagram_url: creatorProfile?.instagram_url ?? undefined,
    tiktok_url: creatorProfile?.tiktok_url ?? undefined,
    x_url: creatorProfile?.x_url ?? undefined,
  };
}

const EMPTY_STATS: CreatorStats = {
  totalEarnings: 0,
  callsThisMonth: 0,
  avgRating: 0,
  upcomingBookings: 0,
  totalFans: 0,
  conversionRate: 0,
};

function areInsightsEqual(current: CreatorInsight[], next: CreatorInsight[]) {
  if (current.length !== next.length) return false;
  return current.every((insight, index) => {
    const nextInsight = next[index];
    return (
      nextInsight &&
      insight.id === nextInsight.id &&
      insight.title === nextInsight.title &&
      insight.description === nextInsight.description &&
      insight.tone === nextInsight.tone &&
      insight.ctaHref === nextInsight.ctaHref &&
      insight.ctaLabel === nextInsight.ctaLabel
    );
  });
}

function calculateProfileStrength(
  user: ReturnType<typeof useAuthContext>["user"],
  activePackageCount: number
) {
  if (!user) return 0;

  let score = 0;
  if (user.full_name) score += 20;
  if (user.username) score += 10;
  if (user.avatar_color) score += 5;
  if (user.avatar_url) score += 15;

  if (isCreatorProfile(user)) {
    if (user.bio) score += 20;
    if (user.category) score += 10;
    if (user.instagram_url || user.tiktok_url || user.x_url) score += 10;
    if (activePackageCount > 0) score += 10;
  }

  return score;
}

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
  const [smartInsights, setSmartInsights] = useState<CreatorInsight[]>([]);
  const [activePackageCount, setActivePackageCount] = useState<number | null>(null);
  const activePackageCountRef = useRef<number | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [clientOrigin, setClientOrigin] = useState("");
  const [liveRequests, setLiveRequests] = useState<LiveRequestRow[]>([]);
  const [loadingLiveRequests, setLoadingLiveRequests] = useState(true);
  const [showLiveRequests, setShowLiveRequests] = useState(false);

  async function handleCancelBooking(booking: any) {
    const bookingId = booking.id;
    setCancellingBookingId(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });

    if (res.ok) {
      setUpcomingBookings((prev: any[]) => prev.filter((booking) => booking.id !== bookingId));
      setStats((prev) => ({
        ...prev,
        upcomingBookings: Math.max(0, prev.upcomingBookings - 1),
      }));
      if (nextJoinableBooking?.id === bookingId) {
        setNextJoinableBooking(null);
      }
    }
    setCancellingBookingId(null);
  }

  async function handleCopyShareLink() {
    if (!user?.username) return;
    const shareUrl = `${window.location.origin}/book/${user.username}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 1600);
  }

  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const creatorName = user.full_name || "Creator";
    const supabase = createClient();
    let refreshTimer: number | null = null;
    let autoCancelTimer: number | null = null;

    async function loadLiveRequests() {
      try {
        const response = await fetch(`/api/live-requests?date=${encodeURIComponent(localDateKey(new Date()))}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load live requests.");
        setLiveRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (error) {
        console.error("Failed to load live requests", error);
        setLiveRequests([]);
      } finally {
        setLoadingLiveRequests(false);
      }
    }

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
        void loadDashboard();
      }, delay);
    }

    async function loadDashboard() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      try {
        // 1. Fetch bookings, live queue joins, profile views, and raw reviews
        const [bookingsRes, liveRes, analyticsSnapshot, packagesRes, availabilityRes, profileRes] = await Promise.all([
          supabase
            .from("bookings")
            .select(`
              id, scheduled_at, duration, price, status, topic, creator_present, fan_present, late_fee_amount, late_fee_paid_at,
              fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
            `)
            .eq("creator_id", userId)
            .order("scheduled_at", { ascending: true }),
          supabase
            .from("live_sessions")
            .select("id, live_queue_entries(id, status, amount_charged, ended_at)")
            .eq("creator_id", userId),
          getCreatorAnalyticsSnapshot(userId, "month"),
          supabase
            .from("call_packages")
            .select("id", { count: "exact", head: true })
            .eq("creator_id", userId)
            .eq("is_active", true),
          supabase
            .from("creator_availability")
            .select("id", { count: "exact", head: true })
            .eq("creator_id", userId)
            .eq("is_active", true),
          supabase
            .from("profiles")
            .select("id, email, full_name, username, avatar_initials, avatar_color, avatar_url, created_at, role, creator_profiles(bio, category, is_live, live_join_fee, instagram_url, tiktok_url, x_url, avg_rating, review_count)")
            .eq("id", userId)
            .single(),
        ]);

      const bookings = bookingsRes.data || [];
      void scheduleAutoCancelCheck(bookings);
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
        const grossBookingAmount = getBookingGrossAmount(
          Number(b.price),
          b.late_fee_amount,
          b.late_fee_paid_at
        );
        const normalizedStatus = deriveBookingStatus(
          b.status,
          b.scheduled_at,
          b.duration,
          now,
          b.creator_present,
          b.fan_present
        );

        if (normalizedStatus === "completed" && b.status !== "completed" && hasBookingEnded(b.scheduled_at, b.duration, now)) {
          expiredBookingIds.push(b.id);
        }
        if (normalizedStatus === "completed" || normalizedStatus === "upcoming" || normalizedStatus === "live") {
          totalEarnedGross += grossBookingAmount;
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
          date: localDateKey(bDate),
          time: bDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          duration: b.duration,
          price: grossBookingAmount * 0.85, // Show their 85% cut!
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

      const nextDelay = getNextBookingRefreshDelay(
        mappedBookings.map((booking: any) => ({
          status: booking.status,
          scheduledAt: booking.scheduledAt,
          duration: booking.duration,
        })),
        now
      );
      if (nextDelay) {
        refreshTimer = window.setTimeout(() => {
          void loadDashboard();
        }, nextDelay);
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
      const profileCreator = Array.isArray(profileRes.data?.creator_profiles)
        ? profileRes.data?.creator_profiles[0]
        : profileRes.data?.creator_profiles;
      const calculatedAvgRating = Number(profileCreator?.avg_rating ?? 0);
      const reviewCount = Number(profileCreator?.review_count ?? 0);

      setStats({
        totalEarnings: creatorCut,
        callsThisMonth: callsMonth,
        avgRating: calculatedAvgRating,
        reviewCount,
        upcomingBookings: upcomingCount,
        totalFans: uniqueFans.size,
        conversionRate: analyticsSnapshot.conversionRate
      });

      const insightsUser = creatorProfileFromRow(profileRes.data);
      if (insightsUser) {
        if (packagesRes.count !== null) {
          activePackageCountRef.current = packagesRes.count;
          setActivePackageCount(packagesRes.count);
        }

        const nextActivePackageCount = activePackageCountRef.current;
        if (nextActivePackageCount !== null) {
          const availabilitySlotCount = availabilityRes.count ?? 0;
          const nextStats: CreatorStats = {
            totalEarnings: creatorCut,
            callsThisMonth: callsMonth,
            avgRating: calculatedAvgRating,
            reviewCount,
            upcomingBookings: upcomingCount,
            totalFans: uniqueFans.size,
            conversionRate: analyticsSnapshot.conversionRate,
          };

          const nextInsights = getCreatorInsights({
            user: insightsUser,
            stats: nextStats,
            analytics: analyticsSnapshot,
            profileStrength: calculateProfileStrength(insightsUser, nextActivePackageCount),
            activePackageCount: nextActivePackageCount,
            availabilitySlotCount,
          });
          setSmartInsights((current) => areInsightsEqual(current, nextInsights) ? current : nextInsights);
        }
      }

      } catch (error) {
        console.error("Failed to load creator dashboard", error);
        setUpcomingBookings([]);
        setNextJoinableBooking(null);
      } finally {
        setLoadingDashboard(false);
      }
    }
    loadDashboard();
    void loadLiveRequests();

    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      void loadDashboard();
      void loadLiveRequests();
    }

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
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "live_requests",
        filter: `creator_id=eq.${userId}`,
      }, () => {
        void loadLiveRequests();
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
  }, [user?.id]);

  const displayName = user?.full_name ?? "Creator";
  const displayUsername = user ? `@${user.username}` : "";
  const displayCategory = user && isCreatorProfile(user) ? user.category : "";
  const avatarInitials = user?.avatar_initials ?? "??";
  const avatarColor = user?.avatar_color ?? "bg-violet-600";
  const avatarUrl = user?.avatar_url ?? undefined;
  const liveRequestCount = liveRequests.length;
  const hasLiveRequests = liveRequestCount > 0;

  const profileStrength = calculateProfileStrength(
    user,
    activePackageCount ?? 0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-8">
      {/* ── Status Banner ── */}
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-serif italic text-brand-ink-muted">Good afternoon,</p>
          <h1 className="truncate text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">{displayName} 👋</h1>
        </div>
        <Link href={user ? getCreatorLiveConsolePath({ id: user.id, username: user.username }) : "/live"}>
          <Button variant="live" className="w-full gap-2 shadow-glow-live sm:w-auto">
            <Radio className="w-4 h-4" />
            Go Live
          </Button>
        </Link>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatsCard
          title="Total Earnings"
          value={formatCurrency(stats.totalEarnings)}
          subtext="All time"
          icon={<DollarSign className="w-5 h-5" />}
          accent="gold"
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
          title="Live Requests"
          value={loadingLiveRequests ? "..." : String(liveRequestCount)}
          subtext={hasLiveRequests ? "Tap to view today's fans" : "No requests today"}
          icon={
            <div className={cn("relative", hasLiveRequests && "animate-pulse")}>
              <Radio className="w-5 h-5" />
              {hasLiveRequests ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" /> : null}
            </div>
          }
          accent={hasLiveRequests ? "live" : "primary"}
          className={cn(
            hasLiveRequests
              ? "border-red-300 bg-red-50/80 shadow-[0_0_0_1px_rgba(239,68,68,0.08)] hover:border-red-400"
              : ""
          )}
          onClick={() => setShowLiveRequests((current) => !current)}
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
          {showLiveRequests && (
            <div className="mb-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">Live Requests</p>
                  <h2 className="mt-1 text-lg font-bold text-brand-ink">Fans who requested a live today</h2>
                  <p className="mt-1 text-sm text-brand-ink-muted">
                    {hasLiveRequests ? `${liveRequestCount} request${liveRequestCount === 1 ? "" : "s"} today` : "No requests today."}
                  </p>
                </div>
                <Button variant="surface" size="sm" onClick={() => setShowLiveRequests(false)}>
                  Close
                </Button>
              </div>

              {hasLiveRequests ? (
                <div className="mt-4 space-y-3">
                  {liveRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border bg-brand-elevated/70 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          initials={request.fanInitials}
                          color={request.fanAvatarColor}
                          imageUrl={request.fanAvatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-brand-ink">{request.fanUsername}</p>
                          <p className="truncate text-xs text-brand-ink-subtle">{request.fanName}</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-xs font-medium text-brand-ink-muted">
                        {new Date(request.requestedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {nextJoinableBooking && (
            <div className="mb-4 rounded-2xl border border-brand-live/30 bg-brand-live/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">Ready To Start</p>
                <p className="mt-1 text-sm text-brand-ink">
                  {nextJoinableBooking.status === "live" ? "Your booking room is live now." : `You can join ${nextJoinableBooking.fanName}'s booking now.`}
                </p>
                <p className="mt-1 text-xs text-brand-ink-subtle">
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
            <h2 className="text-lg font-bold text-brand-ink">Upcoming Bookings</h2>
            <Link href="/calendar" className="text-sm text-brand-primary-light hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loadingDashboard ? (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 flex justify-center text-brand-ink-subtle min-h-[200px] items-center">
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
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-light">Shareable Booking Link</p>
            <p className="mt-2 text-sm text-brand-ink-muted">
              Send fans straight to your public booking page with one link.
            </p>
            <div className="mt-4 rounded-xl border border-brand-border bg-brand-elevated px-3 py-3 text-xs text-brand-ink-muted break-all">
              {clientOrigin && user?.username ? `${clientOrigin}/book/${user.username}` : `/book/${user?.username ?? ""}`}
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="gold" className="w-full" onClick={() => void handleCopyShareLink()} disabled={!user?.username}>
                {copiedShareLink ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>

          {/* Profile card */}
          <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={avatarInitials} color={avatarColor} imageUrl={avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate font-bold text-brand-ink">{displayName}</p>
                <p className="truncate text-xs text-brand-ink-subtle">
                  {displayUsername}{displayCategory ? ` · ${displayCategory}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-brand-ink-subtle">Profile strength</span>
                <span className="text-brand-live font-semibold">{profileStrength}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-brand-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-live"
                  style={{ width: `${profileStrength}%` }}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary-light">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">Smart Insights</p>
                  <p className="text-[11px] text-brand-ink-subtle">Personalized next steps based on your profile and activity.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {smartInsights.map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-brand-border bg-brand-elevated/80 p-3">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-ink">{insight.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-ink-subtle">{insight.description}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 self-start rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                          insight.tone === "action" && "bg-amber-50 text-amber-700",
                          insight.tone === "opportunity" && "bg-brand-primary-bg text-brand-primary-deep",
                          insight.tone === "momentum" && "bg-brand-live/10 text-brand-live"
                        )}
                      >
                        {insight.tone}
                      </span>
                    </div>
                    <Link
                      href={insight.ctaHref}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-primary-light hover:underline"
                    >
                      {insight.ctaLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h3 className="text-sm font-semibold text-brand-ink-muted mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Bookings / Offerings", href: "/management", icon: "⚙️" },
                { label: "View Calendar", href: "/calendar", icon: "📅" },
                { label: "Update Availability", href: "/calendar", icon: "🕐" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-elevated border border-brand-border hover:border-brand-primary/40 transition-colors text-sm text-brand-ink-muted hover:text-brand-ink"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-brand-ink-subtle" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Reviews ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-brand-ink">Recent Reviews</h2>
        </div>
        {loadingReviews ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 flex justify-center">
            <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
          </div>
        ) : dashReviews.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
            <Star className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
            <p className="text-brand-ink-subtle">No reviews yet.</p>
            <p className="text-brand-ink-subtle text-sm mt-1">Reviews from fans will appear here after their calls.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashReviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                <div className="flex items-start gap-3">
                  <Avatar initials={review.fanInitials} color={review.fanColor} imageUrl={review.fanAvatarUrl} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-ink">{review.fanName}</p>
                      <span className="text-xs text-brand-ink-subtle">{review.date}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "w-3.5 h-3.5",
                            n <= review.rating
                              ? "fill-brand-gold text-brand-gold"
                              : "text-brand-ink-subtle"
                          )}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-brand-ink-muted leading-relaxed">{review.comment}</p>
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
