"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Search, Zap, Loader2 } from "lucide-react";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { LiveStageCard } from "@/components/fan/LiveStageCard";
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/types";
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

function shouldRefreshFromLiveSessionChange(payload: any) {
  const previousSession = payload.old;
  const nextSession = payload.new;

  if (payload.eventType === "INSERT" || payload.eventType === "DELETE") return true;

  const wasLive = isSessionFresh(previousSession);
  const isLiveNow = isSessionFresh(nextSession);

  return (
    wasLive !== isLiveNow ||
    previousSession?.is_active !== nextSession?.is_active ||
    previousSession?.daily_room_url !== nextSession?.daily_room_url ||
    previousSession?.creator_id !== nextSession?.creator_id
  );
}

async function fetchCreators(): Promise<Creator[]> {
  const supabase = createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`
      id, full_name, username, created_at,
      avatar_initials, avatar_color, avatar_url,
      creator_profiles(
        bio, category, tags, avg_rating, live_join_fee,
        next_available, booking_interval_minutes,
        scheduled_live_at, scheduled_live_timezone, timezone,
        current_live_session_id, instagram_url, tiktok_url, x_url
      ),
      live_sessions(id, is_active, daily_room_url, last_heartbeat_at)
    `)
    .eq("role", "creator")
    .order("created_at", { ascending: false });

  if (error || !profiles) return [];

  const creatorIds = profiles.map((p: { id: string }) => p.id);
  const { data: allPackages } = await supabase
    .from("call_packages")
    .select("creator_id, price, duration")
    .in("creator_id", creatorIds)
    .eq("is_active", true)
    .order("price");

  const [reviewsRes, completedBookingsRes, completedLiveQueueRes] = await Promise.all([
    supabase.from("reviews").select("creator_id").in("creator_id", creatorIds),
    supabase.from("bookings").select("creator_id").in("creator_id", creatorIds).eq("status", "completed"),
    supabase.from("live_queue_entries").select("id, live_sessions!inner(creator_id)")
      .in("status", ["completed", "skipped"])
      .not("amount_charged", "is", null)
      .in("live_sessions.creator_id", creatorIds),
  ]);

  const packagesByCreator: Record<string, any[]> = {};
  (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
    if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
    packagesByCreator[pkg.creator_id]!.push(pkg);
  });

  const reviewCountByCreator: Record<string, number> = {};
  (reviewsRes.data ?? []).forEach((r: { creator_id: string }) => {
    reviewCountByCreator[r.creator_id] = (reviewCountByCreator[r.creator_id] ?? 0) + 1;
  });

  const totalCallsByCreator: Record<string, number> = {};
  (completedBookingsRes.data ?? []).forEach((b: { creator_id: string }) => {
    totalCallsByCreator[b.creator_id] = (totalCallsByCreator[b.creator_id] ?? 0) + 1;
  });
  (completedLiveQueueRes.data ?? []).forEach((entry: any) => {
    const creatorId = Array.isArray(entry.live_sessions) ? entry.live_sessions[0]?.creator_id : entry.live_sessions?.creator_id;
    if (creatorId) totalCallsByCreator[creatorId] = (totalCallsByCreator[creatorId] ?? 0) + 1;
  });

  const activeSessionIds: string[] = [];
  const sessionToCreator: Record<string, string> = {};
  profiles.forEach((profile: any) => {
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    sessions.forEach((s: any) => {
      if (s?.is_active && !!s?.daily_room_url && !!s?.last_heartbeat_at &&
          Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS) {
        activeSessionIds.push(s.id);
        sessionToCreator[s.id] = profile.id;
      }
    });
  });

  const queueCountByCreator: Record<string, number> = {};
  if (activeSessionIds.length > 0) {
    const { data: queueEntries } = await supabase
      .from("live_queue_entries").select("session_id")
      .in("session_id", activeSessionIds).eq("status", "waiting");
    (queueEntries ?? []).forEach((entry: { session_id: string }) => {
      const creatorId = sessionToCreator[entry.session_id];
      if (creatorId) queueCountByCreator[creatorId] = (queueCountByCreator[creatorId] ?? 0) + 1;
    });
  }

  return profiles.map((profile: any) => {
    const cp = Array.isArray(profile.creator_profiles) ? profile.creator_profiles[0] : profile.creator_profiles;
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    const activeSession = sessions.find((s: any) =>
      s?.is_active === true && !!s?.daily_room_url && !!s?.last_heartbeat_at &&
      Date.now() - new Date(s.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
    ) ?? null;

    const packs = packagesByCreator[profile.id] ?? [];
    const minPrice = packs.length ? Math.min(...packs.map((p: { price: number }) => Number(p.price))) : 0;
    const minDuration = packs.length ? packs[0].duration : 15;
    const liveJoinFee = cp?.live_join_fee ? Number(cp.live_join_fee) : undefined;

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
      avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
      isLive: Boolean(activeSession),
      currentLiveSessionId: activeSession?.id ?? undefined,
      queueCount: queueCountByCreator[profile.id] ?? 0,
      callPrice: minPrice,
      callDuration: minDuration,
      nextAvailable: minPrice > 0 ? (cp?.next_available ?? "Available this week") : "No packages yet",
      totalCalls: totalCallsByCreator[profile.id] ?? 0,
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
      fetchCreators().then((data) => { setCreators(data); setLoading(false); });
    }

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      refreshTimeoutsRef.current = [window.setTimeout(load, 500), window.setTimeout(load, 1800)];
    }

    function clearLiveExpiry(creatorId: string) {
      const id = liveExpiryTimeoutsRef.current[creatorId];
      if (id) { window.clearTimeout(id); delete liveExpiryTimeoutsRef.current[creatorId]; }
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
          if (payload.new.is_live === false) clearLiveExpiry(payload.new.id);
          setCreators((prev) => prev.map((c) =>
            c.id === payload.new.id ? {
              ...c,
              isLive: payload.new.is_live ?? c.isLive,
              currentLiveSessionId: payload.new.current_live_session_id ?? undefined,
              scheduledLiveAt: payload.new.scheduled_live_at ?? undefined,
              scheduledLiveTimeZone: payload.new.scheduled_live_timezone ?? c.scheduledLiveTimeZone,
              liveJoinFee: payload.new.live_join_fee != null ? Number(payload.new.live_join_fee) : c.liveJoinFee,
            } : c
          ));
        }
        scheduleRefreshes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, (payload: any) => {
        const nextSession = payload.new ?? payload.old;
        const creatorId = nextSession?.creator_id;
        if (creatorId) {
          const liveNow = payload.eventType !== "DELETE" && isSessionFresh(nextSession);
          if (liveNow) scheduleLiveExpiry(creatorId, nextSession?.last_heartbeat_at);
          else clearLiveExpiry(creatorId);
          setCreators((prev) => prev.map((c) =>
            c.id === creatorId ? { ...c, isLive: liveNow, currentLiveSessionId: liveNow ? nextSession.id : undefined, queueCount: liveNow ? c.queueCount : 0 } : c
          ));
        }
        if (shouldRefreshFromLiveSessionChange(payload)) {
          scheduleRefreshes();
        }
      })
      .subscribe();

    function refreshIfStale() {
      if (Date.now() - lastLoadAtRef.current >= 60000) load();
    }

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshIfStale(); });

    return () => {
      refreshTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      Object.values(liveExpiryTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
      supabase.removeChannel(channels);
    };
  }, []);

  useEffect(() => {
    if (!user || creators.length === 0) { setSavedCreatorIds(new Set()); return; }
    const supabase = createClient();
    supabase.from("saved_creators").select("creator_id").eq("fan_id", user.id)
      .in("creator_id", creators.map((c) => c.id))
      .then(({ data }: any) => {
        setSavedCreatorIds(new Set((data ?? []).map((e: { creator_id: string }) => e.creator_id)));
      });
  }, [user, creators]);

  const filtered = useMemo(() => {
    let list = creators;
    if (activeCategory !== "All") list = list.filter((c) => c.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [creators, activeCategory, search]);

  const liveCreators = filtered.filter((c) => c.isLive);
  const allCreators  = filtered;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
          <p className="text-sm text-brand-ink-subtle">Loading creators…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">

      {/* ── Page header — editorial, not generic dashboard ── */}
      <div className="px-5 md:px-8 pt-7 pb-5">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-label text-brand-primary mb-1">Friendsly</p>
            <h1 className="font-serif font-normal text-[1.65rem] text-brand-ink tracking-tight leading-tight">
              {activeCategory === "All" ? "Discover" : activeCategory}
            </h1>
          </div>

          {/* Inline search */}
          <div className="flex-1 max-w-xs relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-ink-subtle pointer-events-none" />
            <input
              type="search"
              placeholder="Search creators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-full border border-brand-border bg-white text-brand-ink placeholder:text-brand-ink-subtle text-sm focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-colors shadow-xs-light"
            />
          </div>
        </div>

        {/* Category pills — structural purple accent on active */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all duration-150 ${
                activeCategory === cat
                  ? "bg-brand-primary text-white shadow-sm"
                  : "bg-white border border-brand-border text-brand-ink-muted hover:border-brand-primary/40 hover:text-brand-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live Now — horizontal story rail ── */}
      {liveCreators.length > 0 && (
        <section className="mb-6">
          <div className="px-5 md:px-8 flex items-center gap-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse shrink-0" />
            <h2 className="font-display text-sm font-bold text-brand-ink uppercase tracking-wider">On Air</h2>
            <span className="text-xs text-brand-ink-subtle">{liveCreators.length} live</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-brand-live/10 text-brand-live border border-brand-live/20 font-display font-semibold uppercase tracking-wide">
              <Zap className="w-2.5 h-2.5" />
              Join instantly
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 md:px-8 pb-2 scrollbar-none">
            {liveCreators.map((creator, i) => (
              <div key={creator.id} style={{ animationDelay: `${i * 50}ms` }} className="animate-card-enter">
                <LiveStageCard creator={creator} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Creator grid ── */}
      <section className="px-5 md:px-8 pb-8">
        {allCreators.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-white p-14 text-center shadow-xs-light">
            <p className="text-brand-ink text-base font-semibold font-display">No creators found</p>
            <p className="text-brand-ink-subtle text-sm mt-1.5">
              {search || activeCategory !== "All"
                ? "Try adjusting your search or filters."
                : "Be the first to sign up as a creator!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {allCreators.map((creator, i) => (
              <div key={creator.id} style={{ animationDelay: `${i * 25}ms` }} className="animate-card-enter">
                <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
