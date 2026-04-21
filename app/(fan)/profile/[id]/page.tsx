"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Star, Video, Clock, ArrowLeft, X,
  CheckCircle2, Zap, Calendar,
  ChevronLeft, ChevronRight, Send, Loader2, ExternalLink, Instagram, Music2,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import type { Creator, CallPackage } from "@/types";
import { readJsonResponse } from "@/lib/http";
import { formatCurrency, cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import {
  formatTimeZoneLabel,
  getAvailabilityWindowsForViewer,
  getAvailableStartTimesForViewerDate,
  getBrowserTimeZone,
  getTimeZoneAbbreviation,
  localDateKey,
} from "@/lib/timezones";
import { isNewCreator } from "@/lib/creators";
import { getSocialHandleLabel, sanitizeSocialUrl } from "@/lib/social";
import { getLiveSessionPath, isUuidLike } from "@/lib/routes";

// â”€â”€ Availability Calendar helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LIVE_SESSION_STALE_MS = 45000;
const MIN_BOOKING_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

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

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getPackageAccentClasses(index: number) {
  const accents = [
    {
      pill: "border-brand-primary bg-brand-primary/15 text-brand-primary-light",
      pillInactive: "border-brand-primary/20 bg-brand-primary/8 text-brand-primary-light/80",
      card: "border-brand-primary/25 bg-brand-primary/5 hover:border-brand-primary/50 hover:bg-brand-primary/10",
      price: "text-brand-primary-light",
    },
    {
      pill: "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
      pillInactive: "border-brand-gold/20 bg-brand-gold/5 text-brand-gold/80",
      card: "border-brand-gold/30 bg-brand-gold/5 hover:border-brand-gold/50 hover:bg-brand-gold/10",
      price: "text-brand-gold",
    },
    {
      pill: "border-brand-info/30 bg-brand-info/10 text-brand-info",
      pillInactive: "border-brand-info/20 bg-brand-info/5 text-brand-info/80",
      card: "border-brand-info/30 bg-brand-info/5 hover:border-brand-info hover:bg-brand-info/10",
      price: "text-brand-info",
    },
    {
      pill: "border-brand-live/25 bg-brand-live/10 text-brand-live",
      pillInactive: "border-brand-live/20 bg-brand-live/5 text-brand-live/80",
      card: "border-brand-live/25 bg-brand-live/5 hover:border-brand-live/50 hover:bg-brand-live/10",
      price: "text-brand-live",
    },
  ];

  return accents[index % accents.length];
}

function parseViewerSlotToDate(date: Date, slot: string) {
  const timeParts = slot.match(/(\d+):(\d+)\s+(AM|PM)/);
  let hours = 12;
  let mins = 0;

  if (timeParts) {
    hours = parseInt(timeParts[1], 10);
    mins = parseInt(timeParts[2], 10);
    if (timeParts[3] === "PM" && hours !== 12) hours += 12;
    if (timeParts[3] === "AM" && hours === 12) hours = 0;
  }

  const scheduledDate = new Date(date);
  scheduledDate.setHours(hours, mins, 0, 0);
  return scheduledDate;
}

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

// â”€â”€ Creator data fetcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchCreatorData(creatorRef: string): Promise<{
  creator: Creator | null;
  packages: CallPackage[];
  availability: AvailabilitySlot[];
  reviewCount: number;
}> {
  const supabase = createClient();
  const creatorLookupColumn = isUuidLike(creatorRef) ? "id" : "username";
  const creatorLookupValue = creatorLookupColumn === "username" ? creatorRef.toLowerCase() : creatorRef;

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
    .eq(creatorLookupColumn, creatorLookupValue)
    .eq("role", "creator")
    .single();

  if (!profile) return { creator: null, packages: [], availability: [], reviewCount: 0 };

  const { data: pkgs } = await supabase
    .from("call_packages")
    .select("id, name, duration, price, description, is_active, bookings_count")
    .eq("creator_id", profile.id)
    .eq("is_active", true)
    .order("price");

  let avail: AvailabilitySlot[] | null = null;
  const availRes = await supabase
      .from("creator_availability")
      .select("id, day_of_week, start_time, end_time, package_id")
      .eq("creator_id", profile.id)
      .eq("is_active", true)
      .order("day_of_week");

  if (availRes.error) {
    const fallbackAvailRes = await supabase
      .from("creator_availability")
      .select("id, day_of_week, start_time, end_time")
      .eq("creator_id", profile.id)
      .eq("is_active", true)
      .order("day_of_week");
    avail = fallbackAvailRes.data?.map((slot: any) => ({ ...slot, package_id: null })) ?? [];
  } else {
    avail = availRes.data ?? [];
  }

  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", profile.id);

  const [{ count: completedBookingsCount }, { count: completedLiveQueueCount }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", profile.id)
      .eq("status", "completed"),
    supabase
      .from("live_queue_entries")
      .select("id, live_sessions!inner(creator_id)", { count: "exact", head: true })
      .eq("live_sessions.creator_id", profile.id)
      .in("status", ["completed", "skipped"])
      .not("amount_charged", "is", null),
  ]);

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

// â”€â”€ Review type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [activePackages, setActivePackages] = useState<CallPackage[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBooking, setShowBooking] = useState(false);
  const [bookingInitialDate, setBookingInitialDate] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [availabilityPackageId, setAvailabilityPackageId] = useState<string>("all");

  function openBooking(date?: Date) {
    setBookingInitialDate(date ?? null);
    setShowBooking(true);
  }

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
  const liveHref = creator
    ? getLiveSessionPath({
        creatorId: creator.id,
        creatorUsername: creator.username,
        sessionId: creator.currentLiveSessionId,
      })
    : null;

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

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      refreshTimeoutsRef.current = [window.setTimeout(() => loadCreatorData(supabase), 400)];
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

    loadCreatorData(supabase, !creator?.id);

    if (!creator?.id) {
      return () => {
        refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        clearLiveExpiry();
      };
    }

    // Load reviews from Supabase
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, fan:profiles!fan_id(full_name, avatar_initials, avatar_color, avatar_url)")
      .eq("creator_id", creator.id)
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

    if (user?.role === "fan" && user.id !== creator.id) {
      fetch(`/api/reviews?creatorId=${encodeURIComponent(creator.id)}`)
        .then((res) => readJsonResponse<{ canReview?: boolean }>(res))
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
      .channel(`fan_profile_${creator.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${creator.id}` },
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
        { event: "*", schema: "public", table: "live_sessions", filter: `creator_id=eq.${creator.id}` },
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
  }, [creator?.id, loadCreatorData, user?.id, user?.role]);

  // â”€â”€ Review submission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSubmitReview() {
    if (!user || !creator || reviewRating === 0 || !reviewComment.trim()) return;
    setSubmittingReview(true);
    setReviewError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: creator.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }),
    });
    const data = await readJsonResponse<{ review?: { id: string; created_at?: string }; error?: string }>(res);

    const review = data?.review;

    if (res.ok && review) {
      setReviews((prev) => [
        {
          id: review.id,
          fan: user.full_name ?? "You",
          initials: user.avatar_initials ?? "?",
          color: user.avatar_color ?? "bg-violet-600",
          imageUrl: user.avatar_url ?? undefined,
          rating: reviewRating,
          comment: reviewComment.trim(),
          date: new Date(review.created_at ?? Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
  const isOwnProfile = user?.id === creator?.id;

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
  const countdownPrimaryText = creator.isLive
    ? "Live now"
    : scheduledLiveCountdown ?? "Next live time will be posted here";
  const countdownSecondaryText = creator.isLive
    ? creator.queueCount > 0
      ? `${creator.queueCount} fan${creator.queueCount === 1 ? "" : "s"} waiting to go on stage`
      : "Watch now for free, then join the queue when you're ready."
    : scheduledLiveLabel;
  const showLiveCard = creator.isLive || Boolean(hasLiveRate || scheduledLiveLabel || scheduledLiveCountdown);

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
    availMap[day_of_week].push(`${fmt(start_time)} - ${fmt(end_time)}`);
  });

  Object.assign(availMap, getAvailabilityWindowsForViewer({
    weekDates,
    availability,
    creatorTimeZone: creator.timeZone ?? "America/New_York",
    packageId: availabilityPackageId === "all" ? undefined : availabilityPackageId,
  }));

  const hasBookableLeadTimeSlot = (date: Date) => {
    const slots = getAvailableStartTimesForViewerDate({
      date,
      availability: filteredAvailability,
      creatorTimeZone: creator.timeZone ?? "America/New_York",
      durationMinutes: creator.callDuration,
      incrementMinutes: creator.bookingIntervalMinutes ?? 30,
      packageId: availabilityPackageId === "all" ? undefined : availabilityPackageId,
    });

    return slots.some((slot) => parseViewerSlotToDate(date, slot).getTime() - Date.now() >= MIN_BOOKING_LEAD_TIME_MS);
  };

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
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MOBILE LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="app-safe-screen md:hidden bg-white flex flex-col">
        {/* Sticky mobile header */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between border-b border-brand-border bg-white/95 px-4 pb-3 backdrop-blur-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <Link
            href="/discover"
            className="flex items-center justify-center w-9 h-9 rounded-full text-brand-ink-muted hover:text-brand-ink transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BrandLogo href="/" size="sm" theme="light" />
          <Link
            href="/discover"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </Link>
        </div>

        {/* Scrollable body */}
        <div className={cn("flex-1", (hasPackages || (creator.isLive && hasLiveRate)) && "pb-32")}>
          {/* Hero image */}
          <div className="relative mx-4 mt-4 aspect-square rounded-2xl overflow-hidden">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full flex items-center justify-center", creator.avatarColor ?? "bg-[#4a4878]")}>
                <span className="text-8xl font-bold text-white/70">{creator.avatarInitials}</span>
              </div>
            )}
            {creator.isLive && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-live text-white text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
            )}
          </div>

          {/* Creator info */}
          <div className="px-4 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-brand-ink leading-tight">{creator.name}</h1>
                {hasPackages && (
                  <p className="text-sm text-brand-ink-muted mt-0.5">
                    {formatCurrency(creator.callPrice)} &bull; Session
                  </p>
                )}
                <p className="text-xs text-brand-ink-subtle mt-0.5">{creator.username}</p>
              </div>
              {creator.rating > 0 && (
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "w-3.5 h-3.5",
                        n <= Math.round(creator.rating) ? "fill-brand-gold text-brand-gold" : "text-brand-border"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Price pills */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {hasLiveRate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-live/25 bg-brand-live/5 px-3 py-1.5 text-xs font-semibold text-brand-live">
                  <Zap className="h-3 w-3" />
                  {formatCurrency(creator.liveJoinFee!)} / min
                </span>
              )}
              {hasPackages && (
                <span className="px-3 py-1.5 rounded-full border border-brand-border bg-brand-surface text-xs font-medium text-brand-ink">
                  from {formatCurrency(creator.callPrice)} / session
                </span>
              )}
            </div>

            {hasPackages && (
              <div className="mt-3">
                <Button
                  variant="gold"
                  size="lg"
                  className="w-full gap-2 rounded-2xl shadow-[0_16px_34px_rgba(178,132,39,0.18)]"
                  onClick={() => setShowBooking(true)}
                >
                  <Calendar className="w-4 h-4" />
                  See times
                </Button>
              </div>
            )}
          </div>

          <div className="mx-4 my-5 border-t border-brand-border" />

          {/* Availability */}
          <div className="px-4 mb-6">
            <h2 className="text-base font-bold text-brand-ink mb-3">Availability</h2>

            {activePackages.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setAvailabilityPackageId("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                    availabilityPackageId === "all"
                      ? "border-brand-primary bg-brand-primary/15 text-brand-primary-light"
                      : "border-brand-border bg-brand-elevated text-brand-ink-subtle"
                  )}
                >
                  All offerings
                </button>
                {activePackages.map((pkg) => (
                  (() => {
                    const accent = getPackageAccentClasses(activePackages.findIndex((candidate) => candidate.id === pkg.id));
                    return (
                  <button
                    key={pkg.id}
                    onClick={() => setAvailabilityPackageId(pkg.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                      availabilityPackageId === pkg.id
                        ? accent.pill
                        : accent.pillInactive
                    )}
                  >
                    {pkg.name}
                  </button>
                    );
                  })()
                ))}
              </div>
            )}

            <p className="text-xs text-brand-ink-subtle mb-3">
              Times shown in your local {getTimeZoneAbbreviation(new Date(), viewerTimeZone)}
            </p>
            <p className="text-xs text-brand-ink-muted mb-3 -mt-2">
              Creator schedules in {formatTimeZoneLabel(creator.timeZone ?? "America/New_York")}
            </p>

            {filteredAvailability.length === 0 ? (
              <p className="text-sm text-brand-ink-subtle py-4 text-center">No availability set yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {weekDates.map((date) => {
                  const dow = date.getDay();
                  const slots = availMap[localDateKey(date)] ?? [];
                  const isToday = isSameDay(date, today);
                  const isPast = date < today && !isToday;
                  const hasAnySlots = slots.length > 0 && !isPast;
                  const canBookDate = hasAnySlots && hasBookableLeadTimeSlot(date);
                  return (
                    <button
                      type="button"
                      key={date.toISOString()}
                      onClick={() => {
                        if (!canBookDate) return;
                        openBooking(date);
                      }}
                      disabled={!canBookDate}
                      aria-label={
                        canBookDate
                          ? `Book ${creator.name} on ${formatShortDate(date)}`
                          : hasAnySlots
                            ? `${formatShortDate(date)} has availability but cannot be booked within 24 hours`
                            : `${formatShortDate(date)} has no availability`
                      }
                      className={cn(
                        "rounded-xl p-2 text-center border transition-colors",
                        isToday
                          ? "border-brand-primary/50 bg-brand-primary/10"
                          : canBookDate
                          ? "border-brand-info/35 bg-brand-info/10 active:bg-brand-info/15"
                          : hasAnySlots
                          ? "border-brand-border bg-brand-elevated"
                          : "border-brand-border bg-brand-elevated opacity-50"
                      )}
                    >
                      <p className="text-[9px] uppercase text-brand-ink-subtle font-medium">{DAY_NAMES[dow]}</p>
                      <p className={cn("text-sm font-bold mt-0.5", isToday ? "text-brand-primary-light" : canBookDate ? "text-brand-info" : "text-brand-ink-subtle")}>
                        {date.getDate()}
                      </p>
                      {hasAnySlots ? (
                        <div className="mt-1 space-y-0.5">
                          {slots.slice(0, 2).map((s, i) => (
                            <p key={i} className={cn("text-[8px] leading-tight", canBookDate ? "text-brand-info" : "text-brand-ink-muted")}>{s}</p>
                          ))}
                          {slots.length > 2 && <p className="text-[8px] text-brand-ink-subtle">+{slots.length - 2} more</p>}
                        </div>
                      ) : (
                        <p className="mt-1 text-[8px] text-brand-ink-subtle">{isPast ? "-" : "Off"}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Book a Session */}
          {hasPackages && (
            <div className="px-4 mb-6">
              <h2 className="text-base font-bold text-brand-ink mb-3">Book a Session</h2>
              <div className="space-y-3">
                {activePackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-brand-primary/20 bg-[rgba(133,117,201,0.06)] cursor-pointer active:bg-brand-primary/10 transition-colors"
                    onClick={() => { setAvailabilityPackageId(pkg.id); setShowBooking(true); }}
                  >
                    <p className="font-bold text-brand-ink">{pkg.name}</p>
                    <p className="font-bold text-brand-gold">{formatCurrency(pkg.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLiveCard && (
            <div className="mx-4 mb-6 rounded-3xl border border-brand-live/20 bg-brand-surface p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-live/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-live">
                    <Zap className="h-3 w-3" />
                    Live
                  </div>
                </div>
              </div>

              <p className="text-sm text-brand-ink-muted">
                Free to watch - pay by the minute only when you're on stage with {creator.name}.
              </p>

              <div className="mt-4 rounded-3xl border border-brand-live/15 bg-brand-live/5 px-4 py-5">
                <p className="text-xs uppercase tracking-[0.18em] text-brand-live">Countdown</p>
                <p className="mt-3 text-base font-semibold text-brand-ink">{countdownPrimaryText}</p>
                {countdownSecondaryText ? (
                  <p className="mt-2 text-sm text-brand-ink-muted">{countdownSecondaryText}</p>
                ) : null}
              </div>

              {creator.isLive && hasLiveRate && (
                <Link href={liveHref ?? "#"} className="mt-4 block">
                  <Button variant="live" size="lg" className="w-full gap-2">
                    <Zap className="h-4 w-4" />
                    Watch NOW for free
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* About */}
          {creator.bio && (
            <div className="px-4 mb-6">
              <h2 className="text-base font-bold text-brand-ink mb-2">About</h2>
              <p className="text-sm text-brand-ink-muted leading-relaxed">{creator.bio}</p>
            </div>
          )}

          {/* Reviews (mobile) */}
          {(reviews.length > 0 || (isFan && !isOwnProfile) || creator.reviewCount === 0) && (
            <div className="px-4 mb-6">
              <h2 className="text-base font-bold text-brand-ink mb-3">
                Reviews{creator.reviewCount > 0 ? ` (${creator.reviewCount})` : ""}
              </h2>

              {isFan && !isOwnProfile && canReview && (
                <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 mb-3">
                  {reviewSubmitted ? (
                    <div className="flex items-center gap-2 text-brand-live">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-semibold">Thanks for your review!</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-brand-ink">Leave a review</p>
                      {reviewError && (
                        <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">{reviewError}</div>
                      )}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onMouseEnter={() => setReviewHover(n)} onMouseLeave={() => setReviewHover(0)} onClick={() => setReviewRating(n)} className="p-0.5">
                            <Star className={cn("w-6 h-6", n <= (reviewHover || reviewRating) ? "fill-brand-gold text-brand-gold" : "text-brand-ink-subtle")} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                        placeholder="How was your experience?"
                        rows={3}
                        className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brand-ink-subtle">{reviewComment.length}/500</span>
                        <Button variant="primary" size="sm" disabled={reviewRating === 0 || !reviewComment.trim() || submittingReview} onClick={handleSubmitReview} className="gap-1.5">
                          {submittingReview ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</> : <><Send className="w-3.5 h-3.5" /> Submit</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {reviews.length === 0 && (
                  <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
                    <Star className="mx-auto mb-3 h-8 w-8 text-brand-ink-subtle" />
                    <p className="text-brand-ink-subtle">No reviews yet.</p>
                    <p className="mt-1 text-sm text-brand-ink-subtle">Be the first to leave a review!</p>
                  </div>
                )}
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
                    <div className="flex items-start gap-3">
                      <Avatar initials={review.initials} color={review.color} imageUrl={review.imageUrl} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-brand-ink">{review.fan}</p>
                          <span className="text-xs text-brand-ink-subtle">{review.date}</span>
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5 mb-1">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-brand-gold text-brand-gold" />
                          ))}
                        </div>
                        <p className="text-xs text-brand-ink-muted leading-relaxed">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        {(hasPackages || (creator.isLive && hasLiveRate)) && (
          <div
            className="fixed bottom-0 left-0 right-0 z-20 border-t border-brand-border bg-white/95 px-4 pb-3 pt-3 backdrop-blur-sm"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <div className={cn("grid gap-2", hasPackages && creator.isLive && hasLiveRate ? "grid-cols-2" : "grid-cols-1")}>
              {hasPackages && (
                <Button variant="primary" size="lg" className="w-full" onClick={() => setShowBooking(true)}>
                  See Times
                </Button>
              )}
              {creator.isLive && hasLiveRate && (
                <Link href={liveHref ?? "#"}>
                  <Button variant="live" size="lg" className="w-full gap-2">
                    <Zap className="w-4 h-4" />
                    Watch NOW for free
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
        {false && creator && (
          <div className={cn("fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-brand-border flex flex-col gap-2", hasPackages && "pb-20")}>
            <Link href={liveHref ?? "#"}>
              <Button variant="live" size="lg" className="w-full gap-2">
                <Zap className="w-4 h-4" />
                Join Live · {formatCurrency(creator?.liveJoinFee ?? 0)} / min
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DESKTOP LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="hidden md:block px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/discover" className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>

        {/* Two-column split: photo/bio on left, offering cards stacked on right */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* â”€â”€ LEFT: Creator photo + identity + bio â”€â”€ */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {/* Large portrait photo */}
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-brand-border bg-brand-elevated">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt={creator.name} className="h-full w-full object-cover" />
              ) : (
                <div className={cn("flex h-full w-full items-center justify-center", creator.avatarColor ?? "bg-brand-primary")}>
                  <span className="text-8xl font-bold text-white/70">{creator.avatarInitials}</span>
                </div>
              )}
              {creator.isLive && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand-live px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE NOW
                </div>
              )}
              {creator.isNew && !creator.isLive && (
                <div className="absolute left-3 bottom-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-ink shadow-md">
                  New Creator
                </div>
              )}
            </div>

            {/* Name + identity block */}
            <div>
              <h1 className="flex items-center gap-2 text-[2rem] font-serif font-normal leading-tight text-brand-ink">
                {creator.name}
                <CheckCircle2 className="h-5 w-5 text-brand-primary" />
              </h1>
              {creator.category && (
                <p className="mt-1 text-sm text-brand-ink-muted">{creator.category}</p>
              )}
              <p className="mt-1 text-xs text-brand-ink-subtle">{creator.username}</p>
              {creator.rating > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("h-4 w-4", n <= Math.round(creator.rating) ? "fill-brand-gold text-brand-gold" : "text-brand-border")} />
                  ))}
                  <span className="ml-1 text-sm font-bold text-brand-gold">{creator.rating}</span>
                  <span className="text-xs text-brand-ink-subtle">({creator.reviewCount})</span>
                </div>
              )}
            </div>

            {/* Pricing + scheduled pills */}
            {(hasPackages || hasLiveRate || scheduledLiveCountdown) && (
              <div className="flex flex-wrap gap-2">
                {scheduledLiveCountdown && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-info/30 bg-brand-info/10 px-3 py-1.5">
                    <Calendar className="h-3.5 w-3.5 text-brand-info" />
                    <span className="text-xs font-bold text-brand-info">{scheduledLiveCountdown}</span>
                  </div>
                )}
                {hasLiveRate && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-live/25 bg-brand-live/5 px-3 py-1.5 text-xs font-semibold text-brand-live">
                    <Zap className="h-3 w-3" />
                    {formatCurrency(creator.liveJoinFee!)} / min
                  </span>
                )}
                {hasPackages && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-primary/25 bg-brand-primary/5 px-3 py-1.5 text-xs font-semibold text-brand-primary-light">
                    from {formatCurrency(creator.callPrice)} / session
                  </span>
                )}
              </div>
            )}

            {/* About + socials */}
            {(creator.bio || socialLinks.length > 0) && (
              <div className="border-t border-brand-border pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-brand-ink">About</h2>
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {socialLinks.map(({ key, label, href, icon: Icon }) => (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={label}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border bg-brand-elevated text-brand-ink-muted transition-colors hover:border-brand-primary/40 hover:text-brand-ink"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {creator.bio && (
                  <p className="text-sm leading-relaxed text-brand-ink-muted whitespace-pre-line">{creator.bio}</p>
                )}
                {creator.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {creator.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full border border-brand-border bg-brand-elevated px-2.5 py-1 text-[11px] font-medium text-brand-ink-subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* â”€â”€ RIGHT: Stacked offering cards â”€â”€ */}
          <div className="space-y-4">
            {/* Book a Session card */}
            <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                <Video className="h-3 w-3" />
                Book a video call
              </div>
              <h2 className="text-xl font-serif font-normal text-brand-ink">Book a Session</h2>
              <p className="mt-1 text-sm text-brand-ink-muted">
                Book a 1:1 live video consultation &amp; get personalized advice.
              </p>

              {!hasPackages ? (
                <div className="mt-4 rounded-2xl border border-brand-border bg-brand-elevated py-8 text-center">
                  <p className="text-sm text-brand-ink-subtle">No booking packages available yet.</p>
                  <p className="mt-1 text-xs text-brand-ink-subtle">Check back soon or watch their public live.</p>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-brand-ink-muted">Starting at</p>
                      <p className="text-2xl font-display font-bold text-brand-ink">
                        {formatCurrency(Math.min(...activePackages.map((p) => p.price)))}
                      </p>
                    </div>
                    {creator.rating > 0 && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn("h-3.5 w-3.5", n <= Math.round(creator.rating) ? "fill-brand-gold text-brand-gold" : "text-brand-border")} />
                        ))}
                        <span className="ml-1 text-sm font-bold text-brand-gold">{creator.rating}</span>
                        <span className="text-xs text-brand-ink-subtle">({creator.reviewCount})</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {activePackages.map((pkg) => (
                      (() => {
                        const accent = getPackageAccentClasses(activePackages.findIndex((candidate) => candidate.id === pkg.id));
                        return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => { setAvailabilityPackageId(pkg.id); setShowBooking(true); }}
                        className={cn("flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-colors", accent.card)}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-brand-ink">{pkg.name}</p>
                          {pkg.description && (
                            <p className="mt-1 text-sm text-brand-ink-subtle line-clamp-2">{pkg.description}</p>
                          )}
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand-ink-subtle">
                            <Clock className="h-3 w-3" />
                            {pkg.duration} min
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn("text-lg font-display font-bold", accent.price)}>{formatCurrency(pkg.price)}</p>
                          <p className="mt-0.5 text-[11px] text-brand-ink-subtle">per session</p>
                        </div>
                      </button>
                        );
                      })()
                    ))}
                  </div>

                  <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => setShowBooking(true)}>
                    See times
                  </Button>
                </>
              )}
            </div>

            {showLiveCard && (
              <div className="rounded-3xl border border-brand-live/25 bg-brand-live/5 p-6 shadow-card">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-live px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  <Zap className="h-3 w-3" />
                  Live
                </div>
                <p className="mt-1 text-sm text-brand-ink-muted">
                  Free to watch - pay by the minute only when you're on stage with {creator.name}.
                </p>
                <div className="mt-5">
                  <div className="rounded-3xl border border-brand-live/15 bg-white/70 px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-brand-live">Countdown</p>
                    <p className="mt-3 text-lg font-semibold text-brand-ink">{countdownPrimaryText}</p>
                    {countdownSecondaryText ? (
                      <p className="mt-2 text-sm text-brand-ink-muted">{countdownSecondaryText}</p>
                    ) : null}
                  </div>
                </div>
                {creator.isLive && hasLiveRate && (
                  <Link href={liveHref ?? "#"}>
                    <Button variant="live" size="lg" className="mt-4 w-full gap-2">
                      <Zap className="h-4 w-4" />
                      Watch NOW for free
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* Availability card */}
            <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-serif font-normal text-brand-ink flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-brand-primary-light" />
                    Availability
                  </h2>
                  <p className="mt-1 text-xs text-brand-ink-subtle">
                    Times shown in your local {getTimeZoneAbbreviation(new Date(), viewerTimeZone)}
                  </p>
                  <p className="mt-1 text-xs text-brand-ink-muted">
                    Creator schedules in {formatTimeZoneLabel(creator.timeZone ?? "America/New_York")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    disabled={weekOffset === 0}
                    className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-elevated px-2.5 py-1.5 text-xs font-medium text-brand-ink-muted transition-colors hover:border-brand-primary/40 hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <span className="min-w-[80px] px-2 text-center text-xs font-semibold text-brand-primary-light">
                    {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `${weekOffset} weeks out`}
                  </span>
                  <button
                    onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                    disabled={weekOffset >= 3}
                    className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-elevated px-2.5 py-1.5 text-xs font-medium text-brand-ink-muted transition-colors hover:border-brand-primary/40 hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {activePackages.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setAvailabilityPackageId("all")}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", availabilityPackageId === "all" ? "border-brand-primary bg-brand-primary/15 text-brand-primary-light" : "border-brand-border bg-brand-elevated text-brand-ink-subtle hover:text-brand-ink")}
                  >
                    All offerings
                  </button>
                  {activePackages.map((pkg) => (
                    (() => {
                      const accent = getPackageAccentClasses(activePackages.findIndex((candidate) => candidate.id === pkg.id));
                      return (
                    <button
                      key={pkg.id}
                      onClick={() => setAvailabilityPackageId(pkg.id)}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", availabilityPackageId === pkg.id ? accent.pill : accent.pillInactive)}
                    >
                      {pkg.name}
                    </button>
                      );
                    })()
                  ))}
                </div>
              )}

              {filteredAvailability.length === 0 ? (
                <p className="py-6 text-center text-sm text-brand-ink-subtle">No availability set for this offering yet.</p>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                {weekDates.map((date) => {
                    const dow = date.getDay();
                    const slots = availMap[localDateKey(date)] ?? [];
                    const isToday = isSameDay(date, today);
                    const isPast = date < today && !isToday;
                    const hasAnySlots = slots.length > 0 && !isPast;
                    const canBookDate = hasAnySlots && hasBookableLeadTimeSlot(date);
                    return (
                      <button
                        type="button"
                        key={date.toISOString()}
                        onClick={() => {
                          if (!canBookDate) return;
                          openBooking(date);
                        }}
                        disabled={!canBookDate}
                        aria-label={
                          canBookDate
                            ? `Book ${creator.name} on ${formatShortDate(date)}`
                            : hasAnySlots
                              ? `${formatShortDate(date)} has availability but cannot be booked within 24 hours`
                              : `${formatShortDate(date)} has no availability`
                        }
                        className={cn(
                          "rounded-xl border p-2 text-center transition-all",
                          isToday
                            ? "border-brand-primary/50 bg-brand-primary/10 hover:border-brand-primary"
                            : canBookDate
                            ? "border-brand-info/35 bg-brand-info/10 hover:border-brand-info hover:bg-brand-info/15 cursor-pointer"
                            : hasAnySlots
                            ? "border-brand-border bg-brand-elevated cursor-not-allowed"
                            : "border-brand-border bg-brand-elevated opacity-50 cursor-not-allowed"
                        )}
                      >
                        <p className="text-[10px] font-medium uppercase text-brand-ink-subtle">{DAY_NAMES[dow]}</p>
                        <p className={cn("mt-0.5 text-base font-bold", isToday ? "text-brand-primary-light" : canBookDate ? "text-brand-ink" : "text-brand-ink-subtle")}>
                          {date.getDate()}
                        </p>
                        {hasAnySlots ? (
                          <div className="mt-1 space-y-0.5">
                            {slots.slice(0, 2).map((s, i) => (
                              <p key={i} className={cn("text-[9px] leading-tight", canBookDate ? "text-brand-info" : "text-brand-ink-muted")}>{s}</p>
                            ))}
                            {slots.length > 2 && <p className="text-[9px] text-brand-ink-subtle">+{slots.length - 2} more</p>}
                          </div>
                        ) : (
                          <p className="mt-1 text-[9px] text-brand-ink-subtle">{isPast ? "-" : "Off"}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reviews */}
            <section className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-brand-ink">
                  Reviews <span className="text-brand-ink-subtle font-normal">({creator.reviewCount})</span>
                </h2>
                {creator.rating > 0 && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("w-4 h-4", n <= Math.round(creator.rating) ? "fill-brand-gold text-brand-gold" : "text-brand-ink-subtle")} />
                    ))}
                    <span className="ml-2 text-sm font-bold text-brand-gold">{creator.rating}</span>
                  </div>
                )}
              </div>

              {reviews.length === 0 && !isFan ? (
                <div className="rounded-2xl border border-brand-border bg-brand-elevated p-8 text-center">
                  <Star className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
                  <p className="text-brand-ink-subtle">No reviews yet.</p>
                  <p className="text-brand-ink-subtle text-sm mt-1">Be the first to book a call!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {isFan && !isOwnProfile && canReview && (
                    <div className="rounded-2xl border border-brand-border bg-brand-elevated p-5">
                      {reviewSubmitted ? (
                        <div className="flex items-center gap-2 text-brand-live">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-semibold">Thanks for your review!</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-brand-ink">Leave a review</p>
                          {reviewError && (
                            <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">{reviewError}</div>
                          )}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button key={n} type="button" onMouseEnter={() => setReviewHover(n)} onMouseLeave={() => setReviewHover(0)} onClick={() => setReviewRating(n)} className="p-0.5 transition-transform hover:scale-110">
                                <Star className={cn("w-6 h-6 transition-colors", n <= (reviewHover || reviewRating) ? "fill-brand-gold text-brand-gold" : "text-brand-ink-subtle")} />
                              </button>
                            ))}
                            {reviewRating > 0 && <span className="ml-2 text-sm text-brand-gold font-semibold">{reviewRating}/5</span>}
                          </div>
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                            placeholder="How was your experience?"
                            rows={3}
                            className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-brand-ink-subtle">{reviewComment.length}/500</span>
                            <Button variant="primary" size="sm" disabled={reviewRating === 0 || !reviewComment.trim() || submittingReview} onClick={handleSubmitReview} className="gap-1.5">
                              {submittingReview ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</> : <><Send className="w-3.5 h-3.5" /> Submit Review</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isFan && !isOwnProfile && !canReview && !reviewSubmitted && (
                    <div className="rounded-2xl border border-brand-border bg-brand-elevated p-5">
                      <p className="text-sm font-semibold text-brand-ink">Reviews unlocked after completed sessions</p>
                      <p className="mt-1 text-sm text-brand-ink-subtle">You can leave one review for each completed booking that you have not already reviewed.</p>
                    </div>
                  )}

                  {reviews.length === 0 && (
                    <div className="rounded-2xl border border-brand-border bg-brand-elevated p-8 text-center">
                      <Star className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
                      <p className="text-brand-ink-subtle">No reviews yet.</p>
                      <p className="text-brand-ink-subtle text-sm mt-1">Be the first to leave a review!</p>
                    </div>
                  )}

                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-elevated p-5">
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
        </div>

      </div>

      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => { setShowBooking(false); setBookingInitialDate(null); }}
        packages={activePackages}
        availability={availability}
        initialPackageId={availabilityPackageId === "all" ? undefined : availabilityPackageId}
        initialDate={bookingInitialDate}
      />
    </>
  );
}


