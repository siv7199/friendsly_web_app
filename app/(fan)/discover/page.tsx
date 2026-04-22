"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Radio, Search, Sparkles, Users } from "lucide-react";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isNewCreator } from "@/lib/creators";
import type { Creator } from "@/types";

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

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    All: "Featured",
    "Content Creation": "Influencers",
    "Fitness & Wellness": "Gym",
    "Gaming & Esports": "Gaming",
    "Beauty & Skincare": "Beauty",
    "Business & Startups": "Business",
    "Finance & Investing": "Finance",
    "Music & Arts": "Music",
    "Tech & Career": "Tech",
  };

  return labels[category] ?? category;
}

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

function shouldRefreshFromCreatorProfileChange(payload: any) {
  if (payload.eventType === "INSERT" || payload.eventType === "DELETE") return true;

  const previousProfile = payload.old ?? {};
  const nextProfile = payload.new ?? {};

  return (
    previousProfile.bio !== nextProfile.bio ||
    previousProfile.category !== nextProfile.category ||
    JSON.stringify(previousProfile.tags ?? []) !== JSON.stringify(nextProfile.tags ?? []) ||
    previousProfile.avg_rating !== nextProfile.avg_rating ||
    previousProfile.review_count !== nextProfile.review_count ||
    previousProfile.total_calls !== nextProfile.total_calls ||
    previousProfile.live_join_fee !== nextProfile.live_join_fee ||
    previousProfile.scheduled_live_at !== nextProfile.scheduled_live_at ||
    previousProfile.scheduled_live_timezone !== nextProfile.scheduled_live_timezone ||
    previousProfile.timezone !== nextProfile.timezone
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
        review_count, total_calls, scheduled_live_at,
        scheduled_live_timezone, timezone
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

  const packagesByCreator: Record<string, any[]> = {};
  (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
    if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
    packagesByCreator[pkg.creator_id]!.push(pkg);
  });

  const activeSessionIds: string[] = [];
  const sessionToCreator: Record<string, string> = {};
  profiles.forEach((profile: any) => {
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    sessions.forEach((session: any) => {
      if (
        session?.is_active &&
        session?.daily_room_url &&
        session?.last_heartbeat_at &&
        Date.now() - new Date(session.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
      ) {
        activeSessionIds.push(session.id);
        sessionToCreator[session.id] = profile.id;
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
      if (creatorId) queueCountByCreator[creatorId] = (queueCountByCreator[creatorId] ?? 0) + 1;
    });
  }

  return profiles.map((profile: any) => {
    const creatorProfile = Array.isArray(profile.creator_profiles) ? profile.creator_profiles[0] : profile.creator_profiles;
    const sessions = Array.isArray(profile.live_sessions) ? profile.live_sessions : [];
    const activeSession =
      sessions.find(
        (session: any) =>
          session?.is_active === true &&
          session?.daily_room_url &&
          session?.last_heartbeat_at &&
          Date.now() - new Date(session.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
      ) ?? null;

    const packs = packagesByCreator[profile.id] ?? [];
    const minPrice = packs.length ? Math.min(...packs.map((pkg: { price: number }) => Number(pkg.price))) : 0;
    const minDuration = packs.length ? packs[0].duration : 15;
    const liveJoinFee = creatorProfile?.live_join_fee ? Number(creatorProfile.live_join_fee) : undefined;

    return {
      id: profile.id,
      name: profile.full_name,
      username: `@${profile.username}`,
      createdAt: profile.created_at,
      bio: creatorProfile?.bio ?? "",
      category: creatorProfile?.category ?? "",
      tags: creatorProfile?.tags ?? [],
      followers: "",
      rating: Number(creatorProfile?.avg_rating ?? 0),
      reviewCount: Number(creatorProfile?.review_count ?? 0),
      avatarInitials: profile.avatar_initials,
      avatarColor: profile.avatar_color,
      avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
      isLive: Boolean(activeSession),
      currentLiveSessionId: activeSession?.id ?? undefined,
      queueCount: queueCountByCreator[profile.id] ?? 0,
      callPrice: minPrice,
      callDuration: minDuration,
      nextAvailable: minPrice > 0 ? "Available this week" : "No packages yet",
      totalCalls: Number(creatorProfile?.total_calls ?? 0),
      responseTime: "",
      liveJoinFee,
      scheduledLiveAt: creatorProfile?.scheduled_live_at ?? undefined,
      scheduledLiveTimeZone: creatorProfile?.scheduled_live_timezone ?? creatorProfile?.timezone ?? undefined,
      bookingIntervalMinutes: 30,
      isNew: isNewCreator(profile.created_at),
      instagramUrl: undefined,
      tiktokUrl: undefined,
      xUrl: undefined,
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
  const creatorIdsKey = useMemo(
    () => creators.map((creator) => creator.id).sort().join(","),
    [creators]
  );

  useEffect(() => {
    function load() {
      lastLoadAtRef.current = Date.now();
      fetchCreators().then((data) => {
        setCreators(data);
        setLoading(false);
      });
    }

    function scheduleRefreshes() {
      refreshTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      refreshTimeoutsRef.current = [window.setTimeout(load, 400)];
    }

    function clearLiveExpiry(creatorId: string) {
      const id = liveExpiryTimeoutsRef.current[creatorId];
      if (id) {
        window.clearTimeout(id);
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
    const channel = supabase
      .channel("discover_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles" }, (payload: any) => {
        if (payload.new?.id) {
          if (payload.new.is_live === false || !payload.new.current_live_session_id) clearLiveExpiry(payload.new.id);
          setCreators((prev) =>
            prev.map((creator) =>
              creator.id === payload.new.id
                ? {
                    ...creator,
                    isLive: payload.new.current_live_session_id ? creator.isLive : false,
                    currentLiveSessionId: payload.new.current_live_session_id ?? undefined,
                    queueCount: payload.new.current_live_session_id ? creator.queueCount : 0,
                    scheduledLiveAt: payload.new.scheduled_live_at ?? undefined,
                    scheduledLiveTimeZone: payload.new.scheduled_live_timezone ?? creator.scheduledLiveTimeZone,
                    liveJoinFee: payload.new.live_join_fee != null ? Number(payload.new.live_join_fee) : creator.liveJoinFee,
                  }
                : creator
            )
          );
        }
        if (shouldRefreshFromCreatorProfileChange(payload)) scheduleRefreshes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, (payload: any) => {
        const nextSession = payload.new ?? payload.old;
        const creatorId = nextSession?.creator_id;
        if (creatorId) {
          const liveNow = payload.eventType !== "DELETE" && isSessionFresh(nextSession);
          if (liveNow) scheduleLiveExpiry(creatorId, nextSession?.last_heartbeat_at);
          else clearLiveExpiry(creatorId);

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

        if (shouldRefreshFromLiveSessionChange(payload)) scheduleRefreshes();
      })
      .subscribe();

    function refreshIfStale() {
      if (Date.now() - lastLoadAtRef.current >= 60000) load();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      refreshTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      Object.values(liveExpiryTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!user || creatorIdsKey.length === 0) {
      setSavedCreatorIds(new Set());
      return;
    }

    const supabase = createClient();
    const creatorIds = creatorIdsKey.split(",").filter(Boolean);
    supabase
      .from("saved_creators")
      .select("creator_id")
      .eq("fan_id", user.id)
      .in("creator_id", creatorIds)
      .then(({ data }: any) => {
        setSavedCreatorIds(new Set((data ?? []).map((entry: { creator_id: string }) => entry.creator_id)));
      });
  }, [user, creatorIdsKey]);

  const filtered = useMemo(() => {
    let list = creators;

    if (activeCategory !== "All") {
      list = list.filter((creator) => creator.category === activeCategory);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        (creator) =>
          creator.name.toLowerCase().includes(query) ||
          creator.username.toLowerCase().includes(query) ||
          creator.bio.toLowerCase().includes(query) ||
          creator.category.toLowerCase().includes(query) ||
          creator.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return list;
  }, [creators, activeCategory, search]);

  const liveCreators = filtered.filter((creator) => creator.isLive);
  const nonLiveCreators = filtered.filter((creator) => !creator.isLive);
  const otherCreators = nonLiveCreators.length > 0 ? nonLiveCreators : filtered;
  const spotlightCreators = (liveCreators.length > 0 ? liveCreators : filtered).slice(0, 3);
  const spotlightCount = liveCreators.length > 0 ? liveCreators.length : filtered.length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
          <p className="text-sm text-brand-ink-subtle">Loading creators...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-8 pt-4 md:px-8 md:pb-10 md:pt-7 lg:gap-6">
        <section className="overflow-hidden rounded-[30px] border border-brand-border bg-white shadow-card lg:hidden md:rounded-[34px]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="px-5 py-6 md:px-7 md:py-8">
              <div className="flex items-center justify-center md:justify-start">
                <BrandLogo size="md" theme="light" />
              </div>

              <div className="mt-6 space-y-4 md:mt-8">
                <div className="space-y-3">
                  <p className="text-label text-brand-primary">Discover live-first conversations</p>
                  <h1 className="max-w-[14ch] text-[2rem] font-serif font-normal leading-[1.02] tracking-tight text-brand-ink md:max-w-[12ch] md:text-[3.2rem]">
                    Become friendsly with your favorite creators.
                  </h1>
                  <p className="max-w-[52ch] text-sm leading-6 text-brand-ink-muted md:text-base">
                    Jump into live sessions, save creators you want to revisit, and book 1-on-1 time using the same links and flows already wired into the app.
                  </p>
                </div>

                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-subtle" />
                  <input
                    type="search"
                    placeholder="Who do you want to talk to?"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-12 w-full rounded-full border border-brand-border bg-brand-bg pl-11 pr-4 text-sm text-brand-ink placeholder:text-brand-ink-subtle transition-colors focus:border-brand-primary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
                  />
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                        activeCategory === category
                          ? "border-brand-primary bg-brand-primary-bg text-brand-primary-deep shadow-sm"
                          : "border-brand-border bg-white text-brand-ink-muted hover:border-brand-primary/35 hover:text-brand-ink"
                      }`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden border-l border-brand-border/80 bg-[linear-gradient(180deg,#f8f6ff_0%,#f3efff_100%)] lg:flex lg:flex-col lg:justify-between">
              <div className="border-b border-brand-border/80 px-6 py-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink-subtle">
                  <Radio className="h-3.5 w-3.5 text-brand-live" />
                  <span>{liveCreators.length > 0 ? "Live now" : "Trending now"}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-brand-border bg-white px-4 py-4 shadow-xs-light">
                    <p className="text-3xl font-semibold tracking-tight text-brand-ink">{spotlightCount}</p>
                    <p className="mt-1 text-sm text-brand-ink-muted">
                      {liveCreators.length > 0 ? "creators streaming or ready to join" : "creators matching this view"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-brand-border bg-white px-4 py-4 shadow-xs-light">
                    <div className="flex items-center gap-2 text-brand-primary">
                      <Sparkles className="h-4 w-4" />
                      <p className="text-sm font-semibold">Fastest path</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-brand-ink-muted">
                      Open a live card to join instantly, or use any creator card to save or book without changing backend functionality.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 py-6">
                {spotlightCreators.slice(0, 2).map((creator, index) => (
                  <div key={creator.id} style={{ animationDelay: `${index * 40}ms` }} className="h-full animate-card-enter">
                    <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="hidden lg:block">
          <div className="rounded-[28px] border border-brand-border bg-white px-5 py-4 shadow-card xl:px-6 xl:py-5">
            <div className="flex items-start justify-between gap-6 xl:gap-8">
              <div className="max-w-[240px] xl:max-w-[280px]">
                <p className="text-label text-brand-primary">Friendsly</p>
                <h1 className="mt-1 text-[2rem] font-serif font-normal leading-[0.95] tracking-tight text-brand-ink xl:text-[2.25rem]">
                  Discover
                </h1>
              </div>

              <div className="w-full max-w-[430px] xl:max-w-[460px]">
                <div className="relative ml-auto">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-brand-ink-subtle" />
                  <input
                    type="search"
                    placeholder="Search creators..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-12 w-full rounded-full border border-brand-border bg-white pl-11 pr-5 text-base text-brand-ink placeholder:text-brand-ink-subtle transition-colors focus:border-brand-primary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/15 xl:h-13 xl:text-[1.05rem]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex max-w-[1120px] flex-wrap gap-2 xl:mt-4 xl:gap-2.5">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-150 xl:px-6 xl:py-3 ${
                    activeCategory === category
                      ? "border-brand-primary bg-brand-primary text-white shadow-nav-active"
                      : "border-brand-border bg-white text-brand-ink-muted hover:border-brand-primary/35 hover:text-brand-ink"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 lg:hidden">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[1.9rem] font-serif font-normal leading-tight text-brand-ink md:text-[2.35rem]">
                {liveCreators.length > 0 ? "Live Now" : "Featured Creators"}
              </h2>
              <p className="mt-1 text-sm text-brand-ink-muted">
                {liveCreators.length > 0
                  ? "These creators are streaming live right now."
                  : "No one is live right now — showing trending creators instead."}
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs text-brand-ink-subtle md:flex">
              <Users className="h-3.5 w-3.5" />
              <span>{liveCreators.length > 0 ? `${liveCreators.length} live creators` : `${filtered.length} available creators`}</span>
            </div>
          </div>

          {spotlightCreators.length === 0 ? (
            <div className="rounded-[28px] border border-brand-border bg-white p-10 text-center shadow-xs-light">
              <p className="text-base font-semibold text-brand-ink">No creators found</p>
              <p className="mt-2 text-sm text-brand-ink-subtle">
                Try adjusting your search or filters to surface more creators.
              </p>
            </div>
          ) : (
            <div className="flex snap-x gap-4 overflow-x-auto pb-2 pr-4 scrollbar-none md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">
              {spotlightCreators.map((creator, index) => (
                <div
                  key={creator.id}
                  style={{ animationDelay: `${index * 35}ms` }}
                  className="w-[min(82vw,208px)] shrink-0 snap-start animate-card-enter md:w-auto"
                >
                  <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="hidden lg:block space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[1.6rem] font-serif font-normal leading-tight text-brand-ink">
                {liveCreators.length > 0 ? "Live Now" : "Featured Creators"}
              </h2>
              <p className="mt-1 text-sm text-brand-ink-muted">
                {liveCreators.length > 0
                  ? "These creators are streaming live right now."
                  : "No one is live right now — showing trending creators instead."}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs text-brand-ink-subtle">
              <Users className="h-3.5 w-3.5" />
              <span>{liveCreators.length > 0 ? `${liveCreators.length} live` : `${filtered.length} creators`}</span>
            </div>
          </div>

          {spotlightCreators.length === 0 ? (
            <div className="rounded-[28px] border border-brand-border bg-white p-10 text-center shadow-xs-light">
              <p className="text-base font-semibold text-brand-ink">No creators found</p>
              <p className="mt-2 text-sm text-brand-ink-subtle">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5 xl:grid-cols-4">
              {spotlightCreators.map((creator, index) => (
                <div key={creator.id} style={{ animationDelay: `${index * 35}ms` }} className="h-full animate-card-enter">
                  <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 lg:hidden">
          <div>
            <h2 className="text-[1.75rem] font-serif font-normal leading-tight text-brand-ink md:text-[2.2rem]">
              More Creators
            </h2>
          </div>

          {otherCreators.length === 0 ? (
            <div className="rounded-[28px] border border-brand-border bg-white p-10 text-center shadow-xs-light">
              <p className="text-base font-semibold text-brand-ink">Nothing else to show yet</p>
              <p className="mt-2 text-sm text-brand-ink-subtle">
                {search || activeCategory !== "All"
                  ? "Your current filters are narrow, so try broadening them."
                  : "More creators will appear here as they complete setup."}
              </p>
            </div>
          ) : (
            <div className="flex snap-x gap-4 overflow-x-auto pb-2 pr-4 scrollbar-none md:grid md:grid-cols-2 md:gap-5 md:overflow-visible xl:grid-cols-3 2xl:grid-cols-4">
              {otherCreators.map((creator, index) => (
                <div
                  key={creator.id}
                  style={{ animationDelay: `${index * 25}ms` }}
                  className="w-[min(82vw,208px)] shrink-0 snap-start animate-card-enter md:w-auto"
                >
                  <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="hidden lg:block space-y-4">
          <div>
            <h2 className="text-[1.6rem] font-serif font-normal leading-tight text-brand-ink">
              More Creators
            </h2>
          </div>

          {otherCreators.length === 0 ? (
            <div className="rounded-[28px] border border-brand-border bg-white p-10 text-center shadow-xs-light">
              <p className="text-base font-semibold text-brand-ink">Nothing else to show yet</p>
              <p className="mt-2 text-sm text-brand-ink-subtle">
                {search || activeCategory !== "All"
                  ? "Try broadening your filters."
                  : "More creators will appear here as they join."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5 xl:grid-cols-4">
              {otherCreators.map((creator, index) => (
                <div key={creator.id} style={{ animationDelay: `${index * 25}ms` }} className="h-full animate-card-enter">
                  <InfluencerCard creator={creator} initialIsSaved={savedCreatorIds.has(creator.id)} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
