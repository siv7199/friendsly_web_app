"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Star, Users, Video, Clock, ArrowLeft,
  CheckCircle2, Zap, Calendar,
  TrendingUp, Shield, ChevronLeft, ChevronRight, Send, Loader2, ExternalLink, Instagram, Music2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import type { Creator, CallPackage } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import {
  formatTimeZoneLabel,
  getAvailabilityWindowsForViewer,
  getBrowserTimeZone,
  getTimeZoneAbbreviation,
  localDateKey,
} from "@/lib/timezones";
import { isNewCreator } from "@/lib/creators";
import { getSocialHandleLabel, sanitizeSocialUrl } from "@/lib/social";

// ── Availability Calendar helpers ─────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LIVE_SESSION_STALE_MS = 45000;

function isSessionFresh(session: {
  is_active?: boolean | null;
  daily_room_url?: string | null;
  last_heartbeat_at?: string | null;
}) {
  return Boolean(
    session?.is_active &&
    session?.daily_room_url &&
    session?.last_heartbeat_at &&
    Date.now() - new Date(session.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
  );
}

function getSessionExpiryDelay(lastHeartbeatAt?: string | null) {
  if (!lastHeartbeatAt) return null;
  const remainingMs = LIVE_SESSION_STALE_MS - (Date.now() - new Date(lastHeartbeatAt).getTime());
  return Math.max(1000, remainingMs + 1000);
}

function shouldRefreshFromLiveSessionChange(payload: any) {
  const previousSession = payload.old;
  const nextSession = payload.new;

  if (payload.eventType === "INSERT" || payload.eventType === "DELETE") return true;

  const wasLive = isSessionFresh(previousSession);
  const isLiveNow = isSessionFresh(nextSession);

  return (
    wasLive !== isLiveNow ||
    previousSession?.is_active !== nextSession?.is_active ||
    previousSession?.daily_room_url !== nextSession?.daily_room_url
  );
}

function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

// ── Creator data fetcher ──────────────────────────────────────────────────────

async function fetchCreatorData(id: string): Promise<{
  creator: Creator | null;
  packages: CallPackage[];
  availability: AvailabilitySlot[];
  reviewCount: number;
}> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id, full_name, username, created_at, avatar_initials, avatar_color, avatar_url,
      creator_profiles(
        bio, category, tags, followers_count, avg_rating, response_time, live_join_fee,
        scheduled_live_at, scheduled_live_timezone, timezone, booking_interval_minutes,
        instagram_url, tiktok_url, x_url
      ),
      live_sessions(id, is_active, daily_room_url, last_heartbeat_at)
    `)
    .eq("id", id)
    .eq("role", "creator")
    .single();

  const { data: pkgs } = await supabase
    .from("call_packages")
    .select("id, name, duration, price, description, is_active, bookings_count")
    .eq("creator_id", id)
    .eq("is_active", true)
    .order("price");

  let avail: AvailabilitySlot[] | null = null;
  const availRes = await supabase
    .from("creator_availability")
    .select("id, day_of_week, start_time, end_time, package_id")
    .eq("creator_id", id)
    .eq("is_active", true)
    .order("day_of_week");

  if (availRes.error) {
    const fallbackAvailRes = await supabase
      .from("creator_availability")
      .select("id, day_of_week, start_time, end_time")
      .eq("creator_id", id)
      .eq("is_active", true)
      .order("day_of_week");
    avail = fallbackAvailRes.data?.map((slot: any) => ({ ...slot, package_id: null })) ?? [];
  } else {
    avail = availRes.data ?? [];
  }

  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", id);

  const [{ count: completedBookingsCount }, { count: completedLiveQueueCount }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", id)
      .eq("status", "completed"),
    supabase
      .from("live_queue_entries")
      .select("id, live_sessions!inner(creator_id)", { count: "exact", head: true })
      .eq("live_sessions.creator_id", id)
      .in("status", ["completed", "skipped"])
      .not("amount_charged", "is", null),
  ]);

  if (!profile) return { creator: null, packages: [], availability: [], reviewCount: 0 };

  const cp = Array.isArray(profile.creator_profiles)
    ? profile.creator_profiles[0]
    : profile.creator_profiles;

  const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
  const activeSession = sessions.find(
    (s: any) =>
      s?.is_active === true &&
      !!s?.daily_room_url &&
      !!s?.last_heartbeat_at &&
      Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
  ) ?? null;
  const isActuallyLive = Boolean(activeSession);

  // Get queue count for active session
  let queueCount = 0;
  if (activeSession) {
    const { count } = await supabase
      .from("live_queue_entries")
      .select("*", { count: "exact", head: true })
      .eq("session_id", activeSession.id)
      .eq("status", "waiting");
    queueCount = count ?? 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: CallPackage[] = (pkgs ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    duration: p.duration,
    price: Number(p.price),
    description: p.description,
    isActive: p.is_active,
    bookingsCount: p.bookings_count,
  }));

  const minPrice = packages.length
    ? Math.min(...packages.map((p) => p.price))
    : 0;

  const creator: Creator = {
    id: profile.id,
    name: profile.full_name,
    username: `@${profile.username}`,
    createdAt: profile.created_at,
    bio: cp?.bio ?? "",
    category: cp?.category ?? "",
    tags: cp?.tags ?? [],
    followers: String(cp?.followers_count ?? 0),
    rating: Number(cp?.avg_rating ?? 0),
    reviewCount: reviewCount ?? 0,
    avatarInitials: profile.avatar_initials,
    avatarColor: profile.avatar_color,
    avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
    isLive: isActuallyLive,
    currentLiveSessionId: activeSession?.id ?? undefined,
    queueCount,
    callPrice: minPrice,
    callDuration: packages[0]?.duration ?? 15,
    nextAvailable: minPrice > 0 ? "Available this week" : "No packages yet",
    totalCalls: (completedBookingsCount ?? 0) + (completedLiveQueueCount ?? 0),
      responseTime: cp?.response_time ?? "~5 min",
      liveJoinFee: cp?.live_join_fee ? Number(cp.live_join_fee) : undefined,
      scheduledLiveAt: cp?.scheduled_live_at ?? undefined,
      scheduledLiveTimeZone: cp?.scheduled_live_timezone ?? cp?.timezone ?? undefined,
      timeZone: cp?.timezone ?? "America/New_York",
      bookingIntervalMinutes: cp?.booking_interval_minutes ? Number(cp.booking_interval_minutes) : 30,
      isNew: isNewCreator(profile.created_at),
      instagramUrl: cp?.instagram_url ?? undefined,
      tiktokUrl: cp?.tiktok_url ?? undefined,
      xUrl: cp?.x_url ?? undefined,
  };

  return {
    creator,
    packages,
    availability: avail ?? [],
    reviewCount: reviewCount ?? 0,
  };
}

// ── Review type ───────────────────────────────────────────────────────────────

interface Review {
  id: string;
  fan: string;
  initials: string;
  color: string;
  imageUrl?: string;
  rating: number;
  comment: string;
  date: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [activePackages, setActivePackages] = useState<CallPackage[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBooking, setShowBooking] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [availabilityPackageId, setAvailabilityPackageId] = useState<string>("all");

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const refreshTimeoutsRef = useRef<number[]>([]);
  const liveExpiryTimeoutRef = useRef<number | null>(null);
  const lastLoadAtRef = useRef(0);

  const loadCreatorData = useCallback((supabase = createClient(), incrementProfileView = false) => {
    lastLoadAtRef.current = Date.now();
    fetchCreatorData(params.id).then(({ creator, packages, availability }) => {
      if (!creator) {
        setLoading(false);
        return;
      }

      setCreator(creator);
      setActivePackages(packages);
      setAvailability(availability);
      setLoading(false);

      if (incrementProfileView) {
        supabase.rpc("increment_profile_views", { creator_uuid: creator.id }).then();
      }
    });
  }, [params.id]);

  useEffect(() => {
    const supabase = createClient();
    let incrementedProfileView = false;

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      refreshTimeoutsRef.current = [
        window.setTimeout(() => loadCreatorData(supabase), 500),
        window.setTimeout(() => loadCreatorData(supabase), 1800),
      ];
    }

    function clearLiveExpiry() {
      if (liveExpiryTimeoutRef.current) {
        window.clearTimeout(liveExpiryTimeoutRef.current);
        liveExpiryTimeoutRef.current = null;
      }
    }

    function scheduleLiveExpiry(lastHeartbeatAt?: string | null) {
      clearLiveExpiry();
      const delay = getSessionExpiryDelay(lastHeartbeatAt);
      if (!delay) return;
      liveExpiryTimeoutRef.current = window.setTimeout(() => loadCreatorData(supabase), delay);
    }

    loadCreatorData(supabase, !incrementedProfileView);
    incrementedProfileView = true;

    // Load reviews from Supabase
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, fan:profiles!fan_id(full_name, avatar_initials, avatar_color, avatar_url)")
      .eq("creator_id", params.id)
      .order("created_at", { ascending: false })
      .limit(10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setReviews(data.map((r: any) => {
            const fan = Array.isArray(r.fan) ? r.fan[0] : r.fan;
            return {
              id: r.id,
              fan: (fan as { full_name: string })?.full_name ?? "Fan",
              initials: (fan as { avatar_initials: string })?.avatar_initials ?? "F",
              color: (fan as { avatar_color: string })?.avatar_color ?? "bg-violet-500",
              imageUrl: (fan as { avatar_url?: string | null })?.avatar_url ?? undefined,
              rating: r.rating,
              comment: r.comment ?? "",
              date: new Date(r.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              }),
            };
          }));
        }
      });

    if (user?.role === "fan" && user.id !== params.id) {
      fetch(`/api/reviews?creatorId=${encodeURIComponent(params.id)}`)
        .then((res) => res.json())
        .then((data) => {
          setCanReview(Boolean(data?.canReview));
        })
        .catch(() => {
          setCanReview(false);
        });
    } else {
      setCanReview(false);
    }

    const realtimeChannel = supabase
      .channel(`fan_profile_${params.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${params.id}` },
        (payload: any) => {
          if (payload.new?.is_live === false) {
            clearLiveExpiry();
          }
          setCreator((prev) =>
                prev
                  ? {
                        ...prev,
                        isLive: payload.new?.is_live ?? prev.isLive,
                        currentLiveSessionId: payload.new?.current_live_session_id ?? undefined,
                        scheduledLiveAt: payload.new?.scheduled_live_at ?? undefined,
                        scheduledLiveTimeZone: payload.new?.scheduled_live_timezone ?? prev.scheduledLiveTimeZone,
                        liveJoinFee: payload.new?.live_join_fee != null
                          ? Number(payload.new.live_join_fee)
                    : prev.liveJoinFee,
                }
              : prev
          );
          scheduleRefreshes();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions", filter: `creator_id=eq.${params.id}` },
        (payload: any) => {
          const nextSession = payload.new ?? payload.old;
          const liveNow = payload.eventType !== "DELETE" && isSessionFresh(nextSession);
          if (liveNow) {
            scheduleLiveExpiry(nextSession?.last_heartbeat_at);
          } else {
            clearLiveExpiry();
          }

          setCreator((prev) =>
            prev
              ? {
                  ...prev,
                  isLive: liveNow,
                  currentLiveSessionId: liveNow ? nextSession?.id : undefined,
                  queueCount: liveNow ? prev.queueCount : 0,
                }
              : prev
          );

          if (shouldRefreshFromLiveSessionChange(payload)) {
            scheduleRefreshes();
          }
        }
      )
      .subscribe();

    function refreshIfStale() {
      if (Date.now() - lastLoadAtRef.current >= 60000) {
        loadCreatorData(supabase);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshIfStale();
      }
    }

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      clearLiveExpiry();
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(realtimeChannel);
    };
  }, [loadCreatorData, params.id, user?.id, user?.role]);

  // ── Review submission ─────────────────────────────────────────────────────
  async function handleSubmitReview() {
    if (!user || reviewRating === 0 || !reviewComment.trim()) return;
    setSubmittingReview(true);
    setReviewError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: params.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }),
    });
    const data = await res.json();

    if (res.ok && data.review) {
      setReviews((prev) => [
        {
          id: data.review.id,
          fan: user.full_name ?? "You",
          initials: user.avatar_initials ?? "?",
          color: user.avatar_color ?? "bg-violet-600",
          imageUrl: user.avatar_url ?? undefined,
          rating: reviewRating,
          comment: reviewComment.trim(),
          date: new Date(data.review.created_at ?? Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        },
        ...prev,
      ]);
      setCanReview(false);
      setReviewRating(0);
      setReviewComment("");
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 3000);
    } else {
      setReviewError(data?.error ?? "You can only leave a review after a completed booking, once per booking.");
    }
    setSubmittingReview(false);
  }

  const isFan = user?.role === "fan";
  const isOwnProfile = user?.id === params.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!creator) return notFound();

  const hasPackages   = activePackages.length > 0;
  const hasLiveRate   = Boolean(creator.liveJoinFee && creator.liveJoinFee > 0);
  const weekDates     = getWeekDates(weekOffset);
  const today         = new Date();
  const viewerTimeZone = getBrowserTimeZone();
  const scheduledLiveCountdown = (() => {
    if (!creator.scheduledLiveAt || creator.isLive) return null;
    const diff = new Date(creator.scheduledLiveAt).getTime() - Date.now();
    if (diff <= 0) return "Going live soon";
    const totalMinutes = Math.floor(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `Going live in ${hours}h ${minutes}m` : `Going live in ${minutes}m`;
  })();
  const scheduledLiveLabel = (() => {
    if (!creator.scheduledLiveAt || creator.isLive) return null;
    const scheduledDate = new Date(creator.scheduledLiveAt);
    const timeZone = creator.scheduledLiveTimeZone || creator.timeZone;
    const abbreviation = timeZone ? getTimeZoneAbbreviation(scheduledDate, timeZone) : null;
    return `${scheduledDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}${abbreviation ? ` ${abbreviation}` : ""}`;
  })();

  // Map availability slots: { [dayOfWeek]: string[] of formatted time ranges }
  const filteredAvailability = availability.filter((slot) =>
    availabilityPackageId === "all"
      ? true
      : slot.package_id == null || slot.package_id === availabilityPackageId
  );

  const availMap: Record<string, string[]> = {};
  filteredAvailability.forEach(({ day_of_week, start_time, end_time }) => {
    if (!availMap[day_of_week]) availMap[day_of_week] = [];
    const fmt = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    availMap[day_of_week].push(`${fmt(start_time)} – ${fmt(end_time)}`);
  });

  Object.assign(availMap, getAvailabilityWindowsForViewer({
    weekDates,
    availability,
    creatorTimeZone: creator.timeZone ?? "America/New_York",
    packageId: availabilityPackageId === "all" ? undefined : availabilityPackageId,
  }));

  const socialLinks = [
    {
      key: "instagram",
      label: "Instagram",
      href: sanitizeSocialUrl(creator.instagramUrl ?? ""),
      icon: Instagram,
    },
    {
      key: "tiktok",
      label: "TikTok",
      href: sanitizeSocialUrl(creator.tiktokUrl ?? ""),
      icon: Music2,
    },
    {
      key: "x",
      label: "X",
      href: sanitizeSocialUrl(creator.xUrl ?? ""),
      icon: ExternalLink,
    },
  ].filter((link) => link.href);

  return (
    <>
      <div className="px-4 md:px-8 py-3 max-w-4xl mx-auto space-y-3">
        {/* ── Back ── */}
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>

        {/* ── Profile Hero ── */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
          <div className="flex items-start gap-4">
            <Avatar
              initials={creator.avatarInitials}
              color={creator.avatarColor}
              imageUrl={creator.avatarUrl}
              size="lg"
              isLive={creator.isLive}
              className="shrink-0 border-2 border-brand-surface ring-1 ring-brand-border"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-serif font-normal text-brand-ink leading-tight">{creator.name}</h1>
                  <p className="text-brand-ink-subtle text-xs mt-0.5">{creator.username}</p>
                </div>
                {creator.isLive && (
                  <Badge variant="live" className="shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                    LIVE NOW
                  </Badge>
                )}
              </div>

              {creator.rating > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Star className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
                  <span className="font-bold text-sm text-brand-gold">{creator.rating}</span>
                  <span className="text-xs text-brand-ink-subtle">({creator.reviewCount} reviews)</span>
                </div>
              )}

              {creator.bio && (
                <p className="mt-1.5 text-xs text-brand-ink-muted leading-relaxed line-clamp-2">{creator.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {socialLinks.map(({ key, label, href, icon: Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-elevated px-2.5 py-1 text-xs font-medium text-brand-ink-muted transition-colors hover:border-brand-primary/50 hover:text-brand-ink"
                  >
                    <Icon className="h-3 w-3" />
                    <span>{getSocialHandleLabel(href) || label}</span>
                  </a>
                ))}
                {creator.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-brand-elevated border border-brand-border text-brand-ink-subtle"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {scheduledLiveCountdown && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-info/10 border border-brand-info/30">
                    <Calendar className="w-3.5 h-3.5 text-brand-info" />
                    <span className="text-xs font-bold text-brand-info">{scheduledLiveCountdown}</span>
                    {scheduledLiveLabel && <span className="text-xs text-brand-ink-muted">{scheduledLiveLabel}</span>}
                  </div>
                )}
                {hasLiveRate && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-live/10 border border-brand-live/30">
                    <Zap className="w-3.5 h-3.5 text-brand-live" />
                    <span className="text-xs font-bold text-brand-live">{formatCurrency(creator.liveJoinFee!)}</span>
                    <span className="text-xs text-brand-ink-subtle">/ min</span>
                  </div>
                )}
                {hasPackages && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/10 border border-brand-primary/30">
                    <Calendar className="w-3.5 h-3.5 text-brand-primary-light" />
                    <span className="text-xs font-bold text-brand-primary-light">from {formatCurrency(creator.callPrice)}</span>
                    <span className="text-xs text-brand-ink-subtle">/ session</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile quick-action bar (above-fold, hidden on desktop) ── */}
        {(hasPackages || (creator.isLive && hasLiveRate)) && (
          <div className="md:hidden rounded-2xl border border-brand-border bg-brand-surface p-3.5 flex flex-col gap-2">
            {hasPackages && (
              <Button variant="gold" size="md" className="w-full gap-2" onClick={() => setShowBooking(true)}>
                <Video className="w-4 h-4" />
                Book from {formatCurrency(Math.min(...activePackages.map((p) => p.price)))}
              </Button>
            )}
            {creator.isLive && hasLiveRate && (
              <Link href={`/waiting-room/${creator.id}`}>
                <Button variant="live" size="md" className="w-full gap-2">
                  <Zap className="w-4 h-4" />
                  Join Live · {formatCurrency(creator.liveJoinFee!)} / min
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* ── Left: Sessions + Calendar ── */}
          <div className="md:col-span-2 space-y-3">

            {/* Available sessions */}
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <h2 className="text-base font-bold text-brand-ink mb-3">Book a Session</h2>
              {!hasPackages ? (
                <div className="p-4 rounded-xl border border-brand-border bg-brand-elevated text-center py-8">
                  <p className="text-brand-ink-subtle text-sm">No booking packages available yet.</p>
                  <p className="text-brand-ink-subtle text-xs mt-1">Check back soon or watch their public live.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10 cursor-pointer hover:border-brand-primary/60 transition-colors"
                      onClick={() => {
                        setAvailabilityPackageId(pkg.id);
                        setShowBooking(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-brand-ink">{pkg.name}</p>
                          <p className="text-sm text-brand-ink-subtle mt-1">{pkg.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-brand-ink-subtle">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{pkg.duration} min
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xl font-display font-bold text-gradient-gold">{formatCurrency(pkg.price)}</p>
                          <p className="text-[11px] text-brand-ink-subtle mt-0.5">per session</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Availability Calendar */}
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-brand-ink flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-primary-light" />
                  Availability
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    disabled={weekOffset === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-elevated text-xs font-medium text-brand-ink-muted hover:text-brand-ink hover:border-brand-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-xs font-semibold text-brand-primary-light px-2 min-w-[80px] text-center">
                    {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `${weekOffset} weeks out`}
                  </span>
                  <button
                    onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                    disabled={weekOffset >= 3}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-elevated text-xs font-medium text-brand-ink-muted hover:text-brand-ink hover:border-brand-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {activePackages.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setAvailabilityPackageId("all")}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                      availabilityPackageId === "all"
                        ? "border-brand-primary bg-brand-primary/15 text-brand-primary-light"
                        : "border-brand-border bg-brand-elevated text-brand-ink-subtle hover:text-brand-ink"
                    )}
                  >
                    All offerings
                  </button>
                  {activePackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setAvailabilityPackageId(pkg.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                        availabilityPackageId === pkg.id
                          ? "border-brand-primary bg-brand-primary/15 text-brand-primary-light"
                          : "border-brand-border bg-brand-elevated text-brand-ink-subtle hover:text-brand-ink"
                      )}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs text-brand-ink-subtle mb-4">
                Times shown in your local time ({getTimeZoneAbbreviation(new Date(), viewerTimeZone)}). Creator schedules in {formatTimeZoneLabel(creator.timeZone ?? "America/New_York")}.
              </p>

              {filteredAvailability.length === 0 ? (
                <p className="text-sm text-brand-ink-subtle text-center py-6">
                  No availability set for this offering yet.
                </p>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDates.map((date) => {
                    const dow        = date.getDay();
                    const slots      = availMap[localDateKey(date)] ?? [];
                    const isToday    = isSameDay(date, today);
                    const isPast     = date < today && !isToday;
                    const hasSlots   = slots.length > 0 && !isPast;

                    return (
                      <div
                        key={date.toISOString()}
                        className={cn(
                          "rounded-xl p-2 text-center border transition-all",
                          isToday
                            ? "border-brand-primary/50 bg-brand-primary/10"
                            : hasSlots
                            ? "border-brand-live/30 bg-brand-live/5"
                            : "border-brand-border bg-brand-elevated opacity-50"
                        )}
                      >
                        <p className="text-[10px] uppercase text-brand-ink-subtle font-medium">
                          {DAY_NAMES[dow]}
                        </p>
                        <p className={cn(
                          "text-base font-bold mt-0.5",
                          isToday ? "text-brand-primary-light" : hasSlots ? "text-brand-ink" : "text-brand-ink-subtle"
                        )}>
                          {date.getDate()}
                        </p>
                        {hasSlots ? (
                          <div className="mt-1 space-y-0.5">
                            {slots.slice(0, 2).map((s, i) => (
                              <p key={i} className="text-[9px] text-brand-live leading-tight">{s}</p>
                            ))}
                            {slots.length > 2 && (
                              <p className="text-[9px] text-brand-ink-subtle">+{slots.length - 2} more</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-brand-ink-subtle mt-1">
                            {isPast ? "—" : "Off"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: CTA + Trust Signals ── */}
          <div className="space-y-3 md:sticky md:top-4 md:self-start">

            {/* CTA Card */}
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
              {/* Live queue CTA */}
              {creator.isLive && hasLiveRate && (
                <div className="p-3 rounded-xl bg-brand-live/10 border border-brand-live/30 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
                    <span className="text-xs font-bold text-brand-live uppercase tracking-wider">Live Right Now</span>
                  </div>
                  <p className="text-xl font-display font-bold text-brand-live">
                    {formatCurrency(creator.liveJoinFee!)}
                  </p>
                  <p className="text-xs text-brand-ink-subtle">amount per minute</p>
                  <p className="text-[11px] text-brand-ink-subtle mt-1">
                    {creator.queueCount > 0 ? `${creator.queueCount} waiting` : "Watch now and request a turn"}
                  </p>
                </div>
              )}

              {/* Booking price */}
              {hasPackages && (
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-display font-bold text-brand-ink">
                    {formatCurrency(Math.min(...activePackages.map((p) => p.price)))}
                  </p>
                  <p className="text-xs text-brand-ink-subtle">per session</p>
                </div>
              )}

              {/* Trust items */}
              <div className="space-y-2 text-sm">
                {[
                  "Video call via Daily.co",
                  "Instant booking confirmation",
                  "Cancel up to 24h before",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-brand-ink-subtle">
                    <CheckCircle2 className="w-4 h-4 text-brand-live shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
                {hasLiveRate && (
                  <div className="flex items-center gap-2 text-brand-ink-subtle">
                    <CheckCircle2 className="w-4 h-4 text-brand-live shrink-0" />
                    <span>Live: free to watch, paid by the minute when you are on stage</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {/* 1. Book Button (desktop — already visible above fold on mobile) */}
                {hasPackages ? (
                  <Button variant="gold" size="lg" className="w-full gap-2" onClick={() => setShowBooking(true)}>
                    <Video className="w-4 h-4" />
                    Book from {formatCurrency(Math.min(...activePackages.map((p) => p.price)))}
                  </Button>
                ) : (
                  <Button variant="ghost" size="lg" className="w-full opacity-50 cursor-not-allowed" disabled>
                    Bookings Coming Soon
                  </Button>
                )}

                {/* 2. Watch Live Button */}
                {creator.isLive && hasLiveRate ? (
                  <Link href={`/waiting-room/${creator.id}`}>
                    <Button variant="live" size="lg" className="w-full gap-2">
                      <Zap className="w-4 h-4" />
                      Watch Live {creator.queueCount > 0 ? `• ${creator.queueCount} waiting` : ""}
                    </Button>
                  </Link>
                ) : hasLiveRate ? (
                  <Button variant="outline" size="lg" disabled className="w-full gap-2 opacity-50 cursor-not-allowed">
                    <Zap className="w-4 h-4 text-brand-ink-subtle" />
                    <span className="text-sm truncate">Queue Offline</span>
                  </Button>
                ) : null}
              </div>

              <p className="text-[11px] text-center text-brand-ink-subtle">
                Next available: {creator.nextAvailable}
              </p>
            </div>

            {false && (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 space-y-3">
              <h3 className="text-sm font-bold text-brand-ink-muted">Creator Stats</h3>
              {[
                { icon: TrendingUp, label: "Total calls", value: "0" },
                { icon: Shield, label: "Verified creator", value: "✓" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-brand-ink-subtle">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </div>
                  <span className="font-semibold text-brand-ink">{value}</span>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* ── Reviews ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-brand-ink">
              Reviews{" "}
              <span className="text-brand-ink-subtle font-normal">({creator.reviewCount})</span>
            </h2>
            {creator.rating > 0 && (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "w-4 h-4",
                      n <= Math.round(creator.rating)
                        ? "fill-brand-gold text-brand-gold"
                        : "text-brand-ink-subtle"
                    )}
                  />
                ))}
                <span className="ml-2 text-sm font-bold text-brand-gold">{creator.rating}</span>
              </div>
            )}
          </div>

          {reviews.length === 0 && !isFan ? (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
              <Star className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
              <p className="text-brand-ink-subtle">No reviews yet.</p>
              <p className="text-brand-ink-subtle text-sm mt-1">Be the first to book a call!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Review form — only for fans viewing someone else's profile */}
              {isFan && !isOwnProfile && canReview && (
                <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                  {reviewSubmitted ? (
                    <div className="flex items-center gap-2 text-brand-live">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-semibold">Thanks for your review!</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-brand-ink">Leave a review</p>
                      {reviewError && (
                        <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {reviewError}
                        </div>
                      )}
                      {/* Star rating */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onMouseEnter={() => setReviewHover(n)}
                            onMouseLeave={() => setReviewHover(0)}
                            onClick={() => setReviewRating(n)}
                            className="p-0.5 transition-transform hover:scale-110"
                          >
                            <Star
                              className={cn(
                                "w-6 h-6 transition-colors",
                                n <= (reviewHover || reviewRating)
                                  ? "fill-brand-gold text-brand-gold"
                                  : "text-brand-ink-subtle hover:text-brand-ink-subtle"
                              )}
                            />
                          </button>
                        ))}
                        {reviewRating > 0 && (
                          <span className="ml-2 text-sm text-brand-gold font-semibold">
                            {reviewRating}/5
                          </span>
                        )}
                      </div>
                      {/* Comment */}
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                        placeholder="How was your experience?"
                        rows={3}
                        className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brand-ink-subtle">{reviewComment.length}/500</span>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={reviewRating === 0 || !reviewComment.trim() || submittingReview}
                          onClick={handleSubmitReview}
                          className="gap-1.5"
                        >
                          {submittingReview ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
                          ) : (
                            <><Send className="w-3.5 h-3.5" /> Submit Review</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isFan && !isOwnProfile && !canReview && !reviewSubmitted && (
                <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                  <p className="text-sm font-semibold text-brand-ink">Reviews unlocked after completed sessions</p>
                  <p className="mt-1 text-sm text-brand-ink-subtle">
                    You can leave one review for each completed booking that you have not already reviewed.
                  </p>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 && (
                <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
                  <Star className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
                  <p className="text-brand-ink-subtle">No reviews yet.</p>
                  <p className="text-brand-ink-subtle text-sm mt-1">Be the first to leave a review!</p>
                </div>
              )}
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                  <div className="flex items-start gap-3">
                    <Avatar initials={review.initials} color={review.color} imageUrl={review.imageUrl} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-brand-ink">{review.fan}</p>
                        <span className="text-xs text-brand-ink-subtle">{review.date}</span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5 mb-2">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
                        ))}
                      </div>
                      <p className="text-sm text-brand-ink-muted leading-relaxed">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

        <BookingModal
          creator={creator}
          open={showBooking}
          onClose={() => setShowBooking(false)}
          packages={activePackages}
          availability={availability}
          initialPackageId={availabilityPackageId === "all" ? undefined : availabilityPackageId}
        />
    </>
  );
}
