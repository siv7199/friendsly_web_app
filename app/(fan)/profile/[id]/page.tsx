"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Star, Video, Clock, ArrowLeft,
  CheckCircle2, Zap, Calendar,
  ChevronLeft, ChevronRight, Send, Loader2, ExternalLink, Instagram, Music2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import type { Creator, CallPackage } from "@/types";
import { readJsonResponse } from "@/lib/http";
import { formatCurrency, cn } from "@/lib/utils";
import {
  getAvailableStartTimesForViewerDate,
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

function getScrollContainer(element: HTMLElement | null) {
  let current = element?.parentElement ?? null;

  while (current) {
    const styles = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(styles.overflowY);
    if (canScrollY && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
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

function getMobilePackageAccentStyle(index: number) {
  const accents = [
    {
      borderColor: "rgba(108, 92, 231, 0.24)",
      backgroundColor: "rgba(108, 92, 231, 0.08)",
      boxShadow: "none",
    },
    {
      borderColor: "rgba(245, 158, 11, 0.28)",
      backgroundColor: "rgba(245, 158, 11, 0.08)",
      boxShadow: "none",
    },
    {
      borderColor: "rgba(99, 102, 241, 0.26)",
      backgroundColor: "rgba(99, 102, 241, 0.08)",
      boxShadow: "none",
    },
    {
      borderColor: "rgba(34, 197, 94, 0.24)",
      backgroundColor: "rgba(34, 197, 94, 0.08)",
      boxShadow: "none",
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
  liveSessionLastHeartbeatAt: string | null;
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
        is_live, current_live_session_id,
        instagram_url, tiktok_url, x_url
      )
    `)
    .eq(creatorLookupColumn, creatorLookupValue)
    .eq("role", "creator")
    .single();

  if (!profile) {
    return { creator: null, packages: [], availability: [], reviewCount: 0, liveSessionLastHeartbeatAt: null };
  }

  const cp = Array.isArray(profile.creator_profiles)
    ? profile.creator_profiles[0]
    : profile.creator_profiles;

  const liveSessionQuery = cp?.current_live_session_id
    ? supabase
        .from("live_sessions")
        .select("id, is_active, daily_room_url, last_heartbeat_at, started_at")
        .eq("id", cp.current_live_session_id)
        .eq("creator_id", profile.id)
        .limit(1)
    : supabase
        .from("live_sessions")
        .select("id, is_active, daily_room_url, last_heartbeat_at, started_at")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .order("started_at", { ascending: false })
        .limit(1);

  const [
    { data: pkgs },
    availRes,
    { count: reviewCount },
    { count: completedBookingsCount },
    { count: completedLiveQueueCount },
    liveSessionsRes,
  ] = await Promise.all([
    supabase
      .from("call_packages")
      .select("id, name, duration, price, description, is_active, bookings_count")
      .eq("creator_id", profile.id)
      .eq("is_active", true)
      .order("price"),
    supabase
      .from("creator_availability")
      .select("id, day_of_week, start_time, end_time, package_id")
      .eq("creator_id", profile.id)
      .eq("is_active", true)
      .order("day_of_week"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profile.id),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profile.id)
      .eq("status", "completed"),
    supabase
      .from("live_queue_entries")
      .select("id, live_sessions!inner(creator_id)", { count: "exact", head: true })
      .eq("live_sessions.creator_id", profile.id)
      .in("status", ["completed", "skipped"])
      .not("amount_charged", "is", null),
    liveSessionQuery,
  ]);

  let avail: AvailabilitySlot[] | null = null;

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

  const sessions = liveSessionsRes.data ?? [];
  const freshActiveSession = sessions.find(
    (s: any) =>
      s?.is_active === true &&
      !!s?.daily_room_url &&
      !!s?.last_heartbeat_at &&
      Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
  ) ?? null;
  const activeSession = freshActiveSession ?? sessions.find(
    (s: any) =>
      s?.is_active === true &&
      !!s?.daily_room_url &&
      (!cp?.current_live_session_id || s.id === cp.current_live_session_id)
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
    liveSessionLastHeartbeatAt: freshActiveSession?.last_heartbeat_at ?? null,
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

interface LiveRequestStatus {
  canRequest: boolean;
  hasRequestedToday: boolean;
  requestedAt?: string | null;
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const mobileLiveSectionRef = useRef<HTMLDivElement | null>(null);
  const mobileBookingSectionRef = useRef<HTMLDivElement | null>(null);
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
  const [liveRequestStatus, setLiveRequestStatus] = useState<LiveRequestStatus | null>(null);
  const [submittingLiveRequest, setSubmittingLiveRequest] = useState(false);
  const [liveSessionLastHeartbeatAt, setLiveSessionLastHeartbeatAt] = useState<string | null>(null);
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
  const scrollToMobileSection = useCallback((target: "live" | "booking") => {
    const element = target === "live" ? mobileLiveSectionRef.current : mobileBookingSectionRef.current;
    if (!element) return;

    const scrollContainer = getScrollContainer(element);
    const mobileHeaderOffset = 112;

    if (scrollContainer) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const visibleHeight = scrollContainer.clientHeight - mobileHeaderOffset;
      const targetTop =
        scrollContainer.scrollTop +
        (elementRect.top - containerRect.top) -
        mobileHeaderOffset -
        Math.max(0, (visibleHeight - elementRect.height) / 2);

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    const visibleHeight = window.innerHeight - mobileHeaderOffset;
    const absoluteTop = window.scrollY + rect.top;
    const centeredTop = absoluteTop - mobileHeaderOffset - Math.max(0, (visibleHeight - rect.height) / 2);

    window.scrollTo({
      top: Math.max(0, centeredTop),
      behavior: "smooth",
    });
  }, []);

  const loadCreatorData = useCallback((supabase = createClient(), incrementProfileView = false) => {
    lastLoadAtRef.current = Date.now();
    fetchCreatorData(params.id).then(({ creator, packages, availability, liveSessionLastHeartbeatAt }) => {
      if (!creator) {
        setLiveSessionLastHeartbeatAt(null);
        setLoading(false);
        return;
      }

      setCreator(creator);
      setActivePackages(packages);
      setAvailability(availability);
      setLiveSessionLastHeartbeatAt(liveSessionLastHeartbeatAt);
      setLoading(false);

      if (incrementProfileView) {
        supabase.rpc("increment_profile_views", { creator_uuid: creator.id }).then();
      }
    });
  }, [params.id]);

  useEffect(() => {
    if (liveExpiryTimeoutRef.current) {
      window.clearTimeout(liveExpiryTimeoutRef.current);
      liveExpiryTimeoutRef.current = null;
    }

    const delay = getSessionExpiryDelay(liveSessionLastHeartbeatAt);
    if (!delay) return;

    liveExpiryTimeoutRef.current = window.setTimeout(() => {
      loadCreatorData(createClient());
    }, delay);

    return () => {
      if (liveExpiryTimeoutRef.current) {
        window.clearTimeout(liveExpiryTimeoutRef.current);
        liveExpiryTimeoutRef.current = null;
      }
    };
  }, [liveSessionLastHeartbeatAt, loadCreatorData]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      refreshTimeoutsRef.current = [window.setTimeout(() => loadCreatorData(supabase), 400)];
    }

    loadCreatorData(supabase, !creator?.id);

    if (!creator?.id) {
      return () => {
        refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
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

    if (user?.role === "fan" && user.id !== creator.id) {
      const todayKey = localDateKey(new Date());
      fetch(`/api/live-requests?creatorId=${encodeURIComponent(creator.id)}&date=${encodeURIComponent(todayKey)}`, {
        cache: "no-store",
      })
        .then((res) => readJsonResponse<LiveRequestStatus>(res))
        .then((data) => {
          setLiveRequestStatus({
            canRequest: Boolean(data?.canRequest),
            hasRequestedToday: Boolean(data?.hasRequestedToday),
            requestedAt: data?.requestedAt ?? null,
          });
        })
        .catch(() => {
          setLiveRequestStatus({ canRequest: true, hasRequestedToday: false, requestedAt: null });
        });
    } else {
      setLiveRequestStatus(null);
    }

    const realtimeChannel = supabase
      .channel(`fan_profile_${creator.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${creator.id}` },
        (payload: any) => {
          if (payload.new?.is_live === false || !payload.new?.current_live_session_id) {
            setLiveSessionLastHeartbeatAt(null);
          }
          setCreator((prev) =>
                prev
                  ? {
                        ...prev,
                        isLive: payload.new?.current_live_session_id ? prev.isLive : false,
                        currentLiveSessionId: payload.new?.current_live_session_id ?? undefined,
                        queueCount: payload.new?.current_live_session_id ? prev.queueCount : 0,
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

  async function handleLiveRequest() {
    if (!creator || submittingLiveRequest) return;

    if (!user || user.role !== "fan") {
      window.location.href = `/login?next=${encodeURIComponent(`/profile/${params.id}`)}`;
      return;
    }

    setSubmittingLiveRequest(true);
    setReviewError(null);

    try {
      const response = await fetch("/api/live-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          requestDate: localDateKey(new Date()),
        }),
      });

      const data = await readJsonResponse<{ requestedAt?: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not send live request.");
      }

      setLiveRequestStatus({
        canRequest: true,
        hasRequestedToday: true,
        requestedAt: data?.requestedAt ?? new Date().toISOString(),
      });
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not send live request.");
    } finally {
      setSubmittingLiveRequest(false);
    }
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

  if (!creator) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-brand-border bg-brand-surface p-6 text-center shadow-card">
          <p className="text-lg font-semibold text-brand-ink">Creator not found</p>
          <p className="mt-2 text-sm text-brand-ink-muted">
            This profile may have moved or is no longer available.
          </p>
          <Link href="/discover" className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink/90">
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  const hasPackages   = activePackages.length > 0;
  const hasLiveRate   = Boolean(creator.liveJoinFee && creator.liveJoinFee > 0);
  const weekDates     = getWeekDates(weekOffset);
  const today         = new Date();
  const scheduledLiveCountdown = (() => {
    if (!creator.scheduledLiveAt || creator.isLive) return null;
    const diff = new Date(creator.scheduledLiveAt).getTime() - Date.now();
    if (diff <= 0) return "Going live soon";
    const totalMinutes = Math.floor(diff / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const minutes = totalMinutes % 60;
    if (days >= 1) {
      const remainingHours = totalHours % 24;
      return remainingHours > 0 ? `Going live in ${days}d ${remainingHours}h` : `Going live in ${days}d`;
    }
    return totalHours > 0 ? `Going live in ${totalHours}h ${minutes}m` : `Going live in ${minutes}m`;
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
  const showLiveCard = creator.isLive || Boolean(hasLiveRate || scheduledLiveLabel || scheduledLiveCountdown);
  const liveButtonLabel = (() => {
    if (creator.isLive) return "Join Live";
    if (scheduledLiveCountdown) return scheduledLiveCountdown;
    if (submittingLiveRequest) return "Sending request...";
    if (liveRequestStatus?.hasRequestedToday) return "Come back tomorrow";
    return "Request a live";
  })();
  const liveButtonDisabled = Boolean(
    !creator.isLive && (
      Boolean(scheduledLiveCountdown) ||
      submittingLiveRequest ||
      liveRequestStatus?.hasRequestedToday ||
      (liveRequestStatus !== null && !liveRequestStatus.canRequest)
    )
  );
  const shouldShowLiveButton = showLiveCard && !isOwnProfile;
  const filteredAvailability = availability.filter((slot) =>
    availabilityPackageId === "all"
      ? true
      : slot.package_id == null || slot.package_id === availabilityPackageId
  );
  const scheduledLiveDateKey = creator.scheduledLiveAt
    ? localDateKey(new Date(creator.scheduledLiveAt))
    : null;

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

  const mobileLiveCard = showLiveCard ? (
    <div ref={mobileLiveSectionRef} className="rounded-2xl border border-brand-live/20 bg-brand-surface p-4 shadow-card">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-live/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-live">
        <Zap className="h-3 w-3" />
        Join Friendsly Live
      </div>
      <h2 className="mt-3 text-base font-bold text-brand-ink">Free to watch</h2>
      <p className="mt-1 text-sm text-brand-ink-muted">Quick chats, Q&amp;As, and meet and greets.</p>
      {shouldShowLiveButton && (
        creator.isLive && hasLiveRate ? (
          <Link href={liveHref ?? "#"} className="mt-3 block">
            <Button variant="live" size="lg" className="w-full gap-2">
              <Zap className="h-4 w-4" />
              {liveButtonLabel}
            </Button>
          </Link>
        ) : (
          <Button
            variant={liveButtonDisabled ? "surface" : "live"}
            size="lg"
            className="mt-3 w-full gap-2"
            disabled={liveButtonDisabled}
            onClick={() => void handleLiveRequest()}
          >
            <Zap className="h-4 w-4" />
            {liveButtonLabel}
          </Button>
        )
      )}
    </div>
  ) : null;

  const desktopLiveCard = showLiveCard ? (
    <div className="rounded-2xl border border-brand-live/25 bg-brand-live/5 p-4 shadow-card">
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-live px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
        <Zap className="h-3 w-3" />
        Join Friendsly Live
      </div>
      <h2 className="mt-3 text-xl font-serif font-normal text-brand-ink">Free to watch</h2>
      <p className="mt-1 text-sm text-brand-ink-muted">Quick chats, Q&amp;As, and meet and greets.</p>
      {shouldShowLiveButton && (
        creator.isLive && hasLiveRate ? (
          <Link href={liveHref ?? "#"}>
            <Button variant="live" size="lg" className="mt-3 w-full gap-2">
              <Zap className="h-4 w-4" />
              {liveButtonLabel}
            </Button>
          </Link>
        ) : (
          <Button
            variant={liveButtonDisabled ? "surface" : "live"}
            size="lg"
            className="mt-3 w-full gap-2"
            disabled={liveButtonDisabled}
            onClick={() => void handleLiveRequest()}
          >
            <Zap className="h-4 w-4" />
            {liveButtonLabel}
          </Button>
        )
      )}
    </div>
  ) : null;

  return (
    <>
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MOBILE LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="app-safe-screen md:hidden bg-white flex flex-col">
        {/* Scrollable body */}
        <div className={cn("flex-1", (hasPackages || shouldShowLiveButton) && "pb-32")}>
          <div className="bg-white pb-6">
            <div className="border-b border-brand-border/70 px-4 py-3">
              <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink-muted transition-colors hover:text-brand-ink">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </div>

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
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_0_4px_rgba(239,68,68,0.18)]" />
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
              <div className="mt-2.5 flex flex-wrap gap-2">
                {hasLiveRate && (
                  showLiveCard ? (
                    <button
                      type="button"
                      onClick={() => scrollToMobileSection("live")}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-live/25 bg-brand-live/5 px-3 py-1.5 text-xs font-semibold text-brand-live transition-colors active:bg-brand-live/10"
                    >
                      <Zap className="h-3 w-3" />
                      {formatCurrency(creator.liveJoinFee!)} / min
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-live/25 bg-brand-live/5 px-3 py-1.5 text-xs font-semibold text-brand-live">
                      <Zap className="h-3 w-3" />
                      {formatCurrency(creator.liveJoinFee!)} / min
                    </span>
                  )
                )}
                {hasPackages && (
                  <button
                    type="button"
                    onClick={() => scrollToMobileSection("booking")}
                    className="rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-ink transition-colors active:bg-brand-elevated"
                  >
                    from {formatCurrency(creator.callPrice)} / session
                  </button>
                )}
              </div>

              {creator.isLive && (
                <div className="mt-4">
                  {mobileLiveCard}
                </div>
              )}

              {creator.bio && (
                <div className="mt-4 border-t border-brand-border pb-1 pt-4">
                  <h2 className="mb-2 text-base font-bold text-brand-ink">About</h2>
                  <p className="text-sm leading-relaxed text-brand-ink-muted">{creator.bio}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#fbf9ff_0%,#f3ecff_38%,#ede4ff_100%)] pb-6 pt-5">
            <div className="mx-4 mb-5 border-t border-[rgba(165,148,214,0.5)]" />

            {/* Book a Session */}
            {hasPackages && (
              <div ref={mobileBookingSectionRef} className="px-4 mb-6">
              <h2 className="text-base font-bold text-brand-ink mb-3">Book a Session</h2>
              <div
                className={cn(
                  "grid gap-3",
                  activePackages.length === 1 && "grid-cols-1",
                  activePackages.length === 2 && "grid-cols-2",
                  activePackages.length >= 3 && "grid-cols-3",
                )}
              >
                {activePackages.map((pkg) => (
                  (() => {
                    const accentIndex = activePackages.findIndex((candidate) => candidate.id === pkg.id);
                    const accent = getPackageAccentClasses(accentIndex);
                    const mobileAccentStyle = getMobilePackageAccentStyle(accentIndex);
                    return (
                  <button
                    key={pkg.id}
                    type="button"
                    className="relative isolate flex w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface px-3 pt-3 pb-3.5 text-left shadow-[0_1px_2px_rgba(26,22,40,0.04)] transition-colors active:opacity-80"
                    style={{ ...mobileAccentStyle, backgroundColor: "#FFFFFF", borderColor: "#CEC6E5" }}
                    onClick={() => { setAvailabilityPackageId(pkg.id); setShowBooking(true); }}
                  >
                    <p className="w-full truncate font-bold text-brand-ink">{pkg.name}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-ink-subtle">
                      <Clock className="h-3 w-3" />
                      {pkg.duration} min
                    </span>
                    <p className={cn("relative z-10 mt-1 text-base font-display font-bold", accent.price)}>{formatCurrency(pkg.price)}</p>
                  </button>
                    );
                  })()
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full mt-3" onClick={() => setShowBooking(true)}>
                See times
              </Button>
              </div>
            )}


            {/* Availability */}
            <div className="px-4 mb-6">
              <div className="rounded-2xl border border-brand-primary/15 bg-[linear-gradient(180deg,rgba(108,92,231,0.08),rgba(108,92,231,0.03))] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-brand-ink">Availability</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    disabled={weekOffset === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-border bg-white/90 text-brand-ink transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[78px] text-center text-[11px] font-semibold text-brand-primary-light">
                    {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `${weekOffset} weeks out`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                    disabled={weekOffset >= 3}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-border bg-white/90 text-brand-ink transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

            {activePackages.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setAvailabilityPackageId("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                    availabilityPackageId === "all"
                      ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                      : "border-brand-border bg-white text-brand-ink-subtle"
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
                        : "border-white/70 bg-white/80 text-brand-ink-subtle"
                    )}
                  >
                    {pkg.name}
                  </button>
                    );
                  })()
                ))}
              </div>
            )}

            {filteredAvailability.length === 0 ? (
              <p className="text-sm text-brand-ink-subtle py-4 text-center">No availability set yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {weekDates.map((date) => {
                  const dow = date.getDay();
                  const slots = getAvailableStartTimesForViewerDate({
                    date,
                    availability: filteredAvailability,
                    creatorTimeZone: creator.timeZone ?? "America/New_York",
                    durationMinutes: creator.callDuration,
                    incrementMinutes: creator.bookingIntervalMinutes ?? 30,
                    packageId: availabilityPackageId === "all" ? undefined : availabilityPackageId,
                  });
                  const isToday = isSameDay(date, today);
                  const isPast = date < today && !isToday;
                  const hasAnySlots = slots.length > 0 && !isPast;
                  const canBookDate = hasAnySlots && hasBookableLeadTimeSlot(date);
                  const isScheduledLiveDay = scheduledLiveDateKey === localDateKey(date);
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
                        "flex min-h-[84px] flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition-colors",
                        isScheduledLiveDay
                          ? "border-brand-live/45 bg-brand-live/12 shadow-sm"
                          : isToday
                          ? "border-brand-primary bg-brand-primary/20 shadow-sm"
                          : canBookDate
                          ? "border-brand-info/45 bg-white active:bg-brand-info/15"
                          : hasAnySlots
                          ? "border-brand-border bg-white/80"
                          : "border-brand-border bg-brand-elevated opacity-50"
                      )}
                    >
                      <p className="text-[9px] font-medium uppercase text-brand-ink-subtle">{DAY_NAMES[dow]}</p>
                      <p className={cn(
                        "mt-0.5 text-sm font-bold",
                        isScheduledLiveDay
                          ? "text-brand-live"
                          : isToday
                          ? "text-brand-primary-light"
                          : canBookDate
                          ? "text-brand-info"
                          : "text-brand-ink-subtle"
                      )}>
                        {date.getDate()}
                      </p>
                      <p className={cn(
                        "mt-1 flex w-full items-center justify-center text-center text-[8px] font-medium leading-[1.1]",
                        isScheduledLiveDay
                          ? "text-brand-live"
                          : canBookDate
                          ? "text-brand-info"
                          : "text-brand-ink-subtle"
                      )}>
                        {isScheduledLiveDay ? "Live" : hasAnySlots ? "Available" : isPast ? "-" : "Off"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
              </div>
            </div>

            {!creator.isLive && (
              <div className="px-4 mb-6">
                {mobileLiveCard}
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
        </div>

        {/* Sticky bottom CTA */}
        {(hasPackages || shouldShowLiveButton) && (
          <div
            className="fixed bottom-0 left-0 right-0 z-20 border-t border-brand-border bg-white/95 px-4 pb-3 pt-3 backdrop-blur-sm"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <div className={cn("grid gap-2", hasPackages && shouldShowLiveButton ? "grid-cols-2" : "grid-cols-1")}>
              {hasPackages && (
                <Button variant="primary" size="lg" className="w-full" onClick={() => setShowBooking(true)}>
                  See Times
                </Button>
              )}
              {shouldShowLiveButton && (
                creator.isLive && hasLiveRate ? (
                  <Link href={liveHref ?? "#"}>
                    <Button variant="live" size="lg" className="w-full gap-2">
                      <Zap className="w-4 h-4" />
                      {liveButtonLabel}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant={liveButtonDisabled ? "surface" : "live"}
                    size="lg"
                    className="w-full gap-2"
                    disabled={liveButtonDisabled}
                    onClick={() => void handleLiveRequest()}
                  >
                    <Zap className="w-4 h-4" />
                    {liveButtonLabel}
                  </Button>
                )
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
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.18)]" />
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

            {/* Pricing pills */}
            {(hasPackages || hasLiveRate) && (
              <div className="flex flex-wrap gap-2">
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
            {creator.isLive ? desktopLiveCard : null}

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

                  <div
                    className={cn(
                      "mt-4 grid gap-2",
                      activePackages.length === 1 && "grid-cols-1",
                      activePackages.length === 2 && "grid-cols-2",
                      activePackages.length >= 3 && "grid-cols-3",
                    )}
                  >
                    {activePackages.map((pkg) => (
                      (() => {
                        const accent = getPackageAccentClasses(activePackages.findIndex((candidate) => candidate.id === pkg.id));
                        return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => { setAvailabilityPackageId(pkg.id); setShowBooking(true); }}
                        className={cn("flex w-full min-w-0 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors", accent.card)}
                      >
                        <p className="w-full truncate font-bold text-brand-ink">{pkg.name}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-brand-ink-subtle">
                          <Clock className="h-3 w-3" />
                          {pkg.duration} min
                        </span>
                        <p className={cn("mt-1 text-lg font-display font-bold", accent.price)}>{formatCurrency(pkg.price)}</p>
                      </button>
                        );
                      })()
                    ))}
                  </div>

                  <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => setShowBooking(true)}>
                    See times
                  </Button>
                </>
              )}
            </div>

            {!creator.isLive ? desktopLiveCard : null}

            {/* Availability card */}
            <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-serif font-normal text-brand-ink flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-brand-primary-light" />
                    Availability
                  </h2>
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
                    const slots = getAvailableStartTimesForViewerDate({
                      date,
                      availability: filteredAvailability,
                      creatorTimeZone: creator.timeZone ?? "America/New_York",
                      durationMinutes: creator.callDuration,
                      incrementMinutes: creator.bookingIntervalMinutes ?? 30,
                      packageId: availabilityPackageId === "all" ? undefined : availabilityPackageId,
                    });
                    const isToday = isSameDay(date, today);
                    const isPast = date < today && !isToday;
                    const hasAnySlots = slots.length > 0 && !isPast;
                    const canBookDate = hasAnySlots && hasBookableLeadTimeSlot(date);
                    const isScheduledLiveDay = scheduledLiveDateKey === localDateKey(date);
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
                          isScheduledLiveDay
                            ? "border-brand-live/45 bg-brand-live/12 hover:border-brand-live"
                            : isToday
                            ? "border-brand-primary/50 bg-brand-primary/10 hover:border-brand-primary"
                            : canBookDate
                            ? "border-brand-info/35 bg-brand-info/10 hover:border-brand-info hover:bg-brand-info/15 cursor-pointer"
                            : hasAnySlots
                            ? "border-brand-border bg-brand-elevated cursor-not-allowed"
                            : "border-brand-border bg-brand-elevated opacity-50 cursor-not-allowed"
                        )}
                      >
                        <p className="text-[10px] font-medium uppercase text-brand-ink-subtle">{DAY_NAMES[dow]}</p>
                        <p className={cn(
                          "mt-0.5 text-base font-bold",
                          isScheduledLiveDay
                            ? "text-brand-live"
                            : isToday
                            ? "text-brand-primary-light"
                            : canBookDate
                            ? "text-brand-ink"
                            : "text-brand-ink-subtle"
                        )}>
                          {date.getDate()}
                        </p>
                        <p className={cn(
                          "mt-1 block w-full text-center text-[7px] font-medium leading-[1.05] sm:text-[8px]",
                          isScheduledLiveDay
                            ? "text-brand-live"
                            : canBookDate
                            ? "text-brand-info"
                            : "text-brand-ink-subtle"
                        )}>
                          {isScheduledLiveDay ? "Live" : hasAnySlots ? "Available" : isPast ? "-" : "Off"}
                        </p>
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


