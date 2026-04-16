"use client";

/**
 * Discover Page  (route: /discover)
 *
 * The fan's main browsing page — a grid of creator cards.
 * All data comes from Supabase (profiles + creator_profiles + call_packages).
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { Search, SlidersHorizontal, Zap, Loader2 } from "lucide-react";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { isNewCreator } from "@/lib/creators";
import { useAuthContext } from "@/lib/context/AuthContext";

const CATEGORIES = [
  "All",
  "Fitness & Wellness",
  "Business & Startups",
  "Content Creation",
  "Finance & Investing",
  "Beauty & Skincare",
  "Tech & Career",
  "Music & Arts",
  "Gaming & Esports",
];

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

// ── Fetch all creators from Supabase ──────────────────────────────────────────

async function fetchCreators(): Promise<Creator[]> {
  const supabase = createClient();

  // Get all creator profiles with their base profile data
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      username,
      created_at,
      avatar_initials,
      avatar_color,
      avatar_url,
      creator_profiles(
        bio,
        category,
        tags,
        avg_rating,
        live_join_fee,
        next_available,
        booking_interval_minutes,
        scheduled_live_at,
        scheduled_live_timezone,
        timezone,
        current_live_session_id,
        instagram_url,
        tiktok_url,
        x_url
      ),
      live_sessions(
        id,
        is_active,
        daily_room_url,
        last_heartbeat_at
      )
    `)
    .eq("role", "creator")
    .order("created_at", { ascending: false });

  if (error || !profiles) return [];

  // Get all active call packages in one query
  const creatorIds = profiles.map((p: { id: string }) => p.id);
  const { data: allPackages } = await supabase
    .from("call_packages")
    .select("*")
    .in("creator_id", creatorIds)
    .eq("is_active", true)
    .order("price");

  const [reviewsRes, completedBookingsRes, completedLiveQueueRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("creator_id")
      .in("creator_id", creatorIds),
    supabase
      .from("bookings")
      .select("creator_id")
      .in("creator_id", creatorIds)
      .eq("status", "completed"),
    supabase
      .from("live_queue_entries")
      .select("id, live_sessions!inner(creator_id)")
      .in("status", ["completed", "skipped"])
      .not("amount_charged", "is", null)
      .in("live_sessions.creator_id", creatorIds),
  ]);

  // Group packages by creator_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packagesByCreator: Record<string, any[]> = {};
  (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
    if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
    packagesByCreator[pkg.creator_id]!.push(pkg);
  });

  const reviewCountByCreator: Record<string, number> = {};
  (reviewsRes.data ?? []).forEach((review: { creator_id: string }) => {
    reviewCountByCreator[review.creator_id] = (reviewCountByCreator[review.creator_id] ?? 0) + 1;
  });

  const totalCallsByCreator: Record<string, number> = {};
  (completedBookingsRes.data ?? []).forEach((booking: { creator_id: string }) => {
    totalCallsByCreator[booking.creator_id] = (totalCallsByCreator[booking.creator_id] ?? 0) + 1;
  });
  (completedLiveQueueRes.data ?? []).forEach((entry: any) => {
    const creatorId = Array.isArray(entry.live_sessions)
      ? entry.live_sessions[0]?.creator_id
      : entry.live_sessions?.creator_id;
    if (creatorId) {
      totalCallsByCreator[creatorId] = (totalCallsByCreator[creatorId] ?? 0) + 1;
    }
  });

  // Get queue counts for all active sessions
  const activeSessionIds: string[] = [];
  const sessionToCreator: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles.forEach((profile: any) => {
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    sessions.forEach((s: any) => {
      if (
        s?.is_active &&
        !!s?.daily_room_url &&
        !!s?.last_heartbeat_at &&
        Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
      ) {
        activeSessionIds.push(s.id);
        sessionToCreator[s.id] = profile.id;
      }
    });
  });

  const queueCountByCreator: Record<string, number> = {};
  if (activeSessionIds.length > 0) {
    const { data: queueEntries } = await supabase
      .from("live_queue_entries")
      .select("session_id")
      .in("session_id", activeSessionIds)
      .eq("status", "waiting");

    (queueEntries ?? []).forEach((entry: { session_id: string }) => {
      const creatorId = sessionToCreator[entry.session_id];
      if (creatorId) {
        queueCountByCreator[creatorId] = (queueCountByCreator[creatorId] ?? 0) + 1;
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return profiles.map((profile: any) => {
    // Handling the creator_profiles join (it might be an array or object in Supabase response)
    const cp = Array.isArray(profile.creator_profiles) ? profile.creator_profiles[0] : profile.creator_profiles;
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    const activeSession = sessions.find(
      (s: any) =>
        s?.is_active === true &&
        !!s?.daily_room_url &&
        !!s?.last_heartbeat_at &&
        Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
    ) ?? null;
    const isActuallyLive = Boolean(activeSession);

    const packages = packagesByCreator[profile.id] ?? [];
    const minPrice = packages.length
      ? Math.min(...packages.map((p: { price: number }) => Number(p.price)))
      : 0;
    const minDuration = packages.length ? packages[0].duration : 15;

    const hasPackages = minPrice > 0;
    const liveJoinFee = cp?.live_join_fee ? Number(cp.live_join_fee) : undefined;
    const totalCalls = totalCallsByCreator[profile.id] ?? 0;

    return {
      id: profile.id,
      name: profile.full_name,
      username: `@${profile.username}`,
      createdAt: profile.created_at,
      bio: cp?.bio ?? "",
      category: cp?.category ?? "",
      tags: cp?.tags ?? [],
      followers: "",
      rating: Number(cp?.avg_rating ?? 0),
      reviewCount: reviewCountByCreator[profile.id] ?? 0,
      avatarInitials: profile.avatar_initials,
      avatarColor: profile.avatar_color,
      avatarUrl: profile.avatar_url ?? undefined,
      isLive: isActuallyLive,
      currentLiveSessionId: activeSession?.id ?? undefined,
      queueCount: queueCountByCreator[profile.id] ?? 0,
      callPrice: minPrice,
      callDuration: minDuration,
      nextAvailable: hasPackages ? (cp?.next_available ?? "Available this week") : "No packages yet",
      totalCalls,
        responseTime: "",
        liveJoinFee,
        scheduledLiveAt: cp?.scheduled_live_at ?? undefined,
      scheduledLiveTimeZone: cp?.scheduled_live_timezone ?? cp?.timezone ?? undefined,
      bookingIntervalMinutes: cp?.booking_interval_minutes ? Number(cp.booking_interval_minutes) : 30,
      isNew: isNewCreator(profile.created_at),
      instagramUrl: cp?.instagram_url ?? undefined,
      tiktokUrl: cp?.tiktok_url ?? undefined,
      xUrl: cp?.x_url ?? undefined,
      } satisfies Creator;
  });
}

function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

export default function DiscoverPage() {
  const { user } = useAuthContext();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedCreatorIds, setSavedCreatorIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const refreshTimeoutsRef = useRef<number[]>([]);
  const liveExpiryTimeoutsRef = useRef<Record<string, number>>({});
  const lastLoadAtRef = useRef(0);

  useEffect(() => {
    function load() {
      lastLoadAtRef.current = Date.now();
      fetchCreators().then((data) => {
        setCreators(data);
        setLoading(false);
      });
    }

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      refreshTimeoutsRef.current = [
        window.setTimeout(load, 500),
        window.setTimeout(load, 1800),
      ];
    }

    function clearLiveExpiry(creatorId: string) {
      const timeoutId = liveExpiryTimeoutsRef.current[creatorId];
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        delete liveExpiryTimeoutsRef.current[creatorId];
      }
    }

    function scheduleLiveExpiry(creatorId: string, lastHeartbeatAt?: string | null) {
      clearLiveExpiry(creatorId);
      const delay = getSessionExpiryDelay(lastHeartbeatAt);
      if (!delay) return;
      liveExpiryTimeoutsRef.current[creatorId] = window.setTimeout(load, delay);
    }

    load();

    const supabase = createClient();
    const channels = supabase
      .channel("discover_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles" }, (payload: any) => {
        if (payload.new?.id) {
          if (payload.new.is_live === false) {
            clearLiveExpiry(payload.new.id);
          }
          setCreators((prev) =>
            prev.map((creator) =>
              creator.id === payload.new.id
                ? {
                      ...creator,
                      isLive: payload.new.is_live ?? creator.isLive,
                      currentLiveSessionId: payload.new.current_live_session_id ?? undefined,
                      scheduledLiveAt: payload.new.scheduled_live_at ?? undefined,
                      scheduledLiveTimeZone: payload.new.scheduled_live_timezone ?? creator.scheduledLiveTimeZone,
                      liveJoinFee: payload.new.live_join_fee != null
                        ? Number(payload.new.live_join_fee)
                        : creator.liveJoinFee,
                  }
                : creator
            )
          );
        }
        scheduleRefreshes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, (payload: any) => {
        const nextSession = payload.new ?? payload.old;
        const creatorId = nextSession?.creator_id;

        if (creatorId) {
          const liveNow = payload.eventType !== "DELETE" && isSessionFresh(nextSession);
          if (liveNow) {
            scheduleLiveExpiry(creatorId, nextSession?.last_heartbeat_at);
          } else {
            clearLiveExpiry(creatorId);
          }
          setCreators((prev) =>
            prev.map((creator) =>
              creator.id === creatorId
                ? {
                    ...creator,
                    isLive: liveNow,
                    currentLiveSessionId: liveNow ? nextSession.id : undefined,
                    queueCount: liveNow ? creator.queueCount : 0,
                  }
                : creator
            )
          );
        }

        scheduleRefreshes();
      })
      .subscribe();

    function refreshIfStale() {
      if (Date.now() - lastLoadAtRef.current >= 60000) {
        load();
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
      Object.values(liveExpiryTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channels);
    };
  }, []);

  useEffect(() => {
    if (!user || creators.length === 0) {
      setSavedCreatorIds(new Set());
      return;
    }

    const supabase = createClient();
    const creatorIds = creators.map((creator) => creator.id);

    supabase
      .from("saved_creators")
      .select("creator_id")
      .eq("fan_id", user.id)
      .in("creator_id", creatorIds)
      .then(({ data }: any) => {
        setSavedCreatorIds(new Set((data ?? []).map((entry: { creator_id: string }) => entry.creator_id)));
      });
  }, [user, creators]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = creators;

    // Category filter
    if (activeCategory !== "All") {
      list = list.filter((c) => c.category === activeCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [creators, activeCategory, search]);

  const liveCreators = filtered.filter((c) => c.isLive);
  const allCreators = filtered;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          <p className="text-sm text-slate-500">Loading creators…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-3xl font-black text-slate-100">Discover Creators</h1>
        <p className="text-slate-400 mt-1">
          Book 1-on-1 calls with experts who know what they&apos;re talking about.
        </p>
      </div>

      {/* ── Search + Filter Bar ── */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="Search creators, topics, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-brand-border bg-brand-surface text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <button className="h-11 px-4 rounded-xl border border-brand-border bg-brand-surface text-slate-400 hover:text-slate-100 hover:border-brand-primary/40 transition-colors flex items-center gap-2 text-sm">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* ── Category Pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? "bg-brand-primary text-white shadow-glow-primary"
                : "bg-brand-surface border border-brand-border text-slate-400 hover:border-brand-primary/40 hover:text-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Live Now Section ── */}
      {liveCreators.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-live animate-pulse" />
            <h2 className="text-lg font-bold text-slate-100">Live Now</h2>
            <span className="text-sm text-slate-500">{liveCreators.length} streaming</span>
            <div className="ml-auto">
              <span className="text-xs px-2 py-1 rounded-full bg-brand-live/10 text-brand-live border border-brand-live/20 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Join instantly
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveCreators.map((creator) => (
              <InfluencerCard
                key={creator.id}
                creator={creator}
                initialIsSaved={savedCreatorIds.has(creator.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── All Creators ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">All Creators</h2>
          <span className="text-sm text-slate-500">{allCreators.length} available</span>
        </div>
        {allCreators.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
            <p className="text-slate-400  text-lg font-semibold">No creators found</p>
            <p className="text-slate-500 text-sm mt-1">
              {search || activeCategory !== "All"
                ? "Try adjusting your search or filters."
                : "Be the first to sign up as a creator!"}
            </p>
          </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {allCreators.map((creator) => (
                <InfluencerCard
                  key={creator.id}
                  creator={creator}
                  initialIsSaved={savedCreatorIds.has(creator.id)}
                />
              ))}
            </div>
        )}
      </section>
    </div>
  );
}
