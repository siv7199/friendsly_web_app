"use client";

/**
 * Fan Saved Page  (route: /saved)
 *
 * Shows creators the fan has saved/hearted.
 * Data comes from the Supabase `saved_creators` table.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, Compass, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { useAuthContext } from "@/lib/context/AuthContext";
import { fetchLiveAudienceCounts } from "@/lib/live-audience";
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/types";
import { isNewCreator } from "@/lib/creators";
import { AccountRequired } from "@/components/shared/AccountRequired";

const LIVE_SESSION_STALE_MS = 45000;

function isSessionFresh(session: {
  id?: string | null;
  is_active?: boolean | null;
  daily_room_url?: string | null;
  last_heartbeat_at?: string | null;
}) {
  return Boolean(
    session?.id &&
      session?.is_active &&
      session?.daily_room_url &&
      session?.last_heartbeat_at &&
      Date.now() - new Date(session.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
  );
}

export default function SavedPage() {
  const { user, isLoading: authLoading } = useAuthContext();
  const [savedCreators, setSavedCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSaved();
  }, [user]);

  async function loadSaved() {
    const supabase = createClient();

    // Fetch saved creator IDs with their profile data
    const { data: saved } = await supabase
      .from("saved_creators")
      .select(
        `id, creator_id,
           creator:profiles!creator_id(
           id, full_name, username, avatar_initials, avatar_color, avatar_url, created_at,
            creator_profiles(
              category, live_join_fee, booking_interval_minutes,
              scheduled_live_at, scheduled_live_timezone, timezone,
              avg_rating, review_count, total_calls, next_available
            )
         )`
      )
      .eq("fan_id", user!.id)
      .order("created_at", { ascending: false });

    if (!saved) {
      setLoading(false);
      return;
    }

    // Also fetch active packages for these creators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creatorIds = saved.map((s: any) => {
      const creator = Array.isArray(s.creator) ? s.creator[0] : s.creator;
      return (creator as { id: string })?.id;
    }).filter(Boolean);

    const [{ data: allPackages }, { data: liveSessions }] = await Promise.all([
      supabase
        .from("call_packages")
        .select("creator_id, price, duration")
        .in("creator_id", creatorIds)
        .eq("is_active", true)
        .order("price"),
      creatorIds.length > 0
        ? supabase
            .from("live_sessions")
            .select("id, creator_id, is_active, daily_room_url, last_heartbeat_at, started_at")
            .in("creator_id", creatorIds)
            .eq("is_active", true)
            .not("daily_room_url", "is", null)
            .order("started_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packagesByCreator: Record<string, any[]> = {};
    (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
      if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
      packagesByCreator[pkg.creator_id]!.push(pkg);
    });

    const activeSessionByCreator: Record<string, {
      id: string;
      is_active: boolean | null;
      daily_room_url: string | null;
      last_heartbeat_at: string | null;
    }> = {};
    (liveSessions ?? []).forEach((session: any) => {
      if (!session?.creator_id || activeSessionByCreator[session.creator_id]) return;
      if (!isSessionFresh(session)) return;
      activeSessionByCreator[session.creator_id] = session;
    });
    const activeSessionIds = Object.values(activeSessionByCreator).map((session) => session.id);
    const sessionToCreator: Record<string, string> = {};
    Object.entries(activeSessionByCreator).forEach(([creatorId, session]) => {
      sessionToCreator[session.id] = creatorId;
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
    const audienceCountBySession = await fetchLiveAudienceCounts(activeSessionIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators: Creator[] = saved.map((s: any) => {
      const profile = Array.isArray(s.creator) ? s.creator[0] : s.creator;
      const p = profile as {
        id: string;
        full_name: string;
        username: string;
        created_at: string;
        avatar_initials: string;
        avatar_color: string;
        avatar_url: string | null;
        creator_profiles: {
          category: string;
          live_join_fee: number | null;
          scheduled_live_at: string | null;
          scheduled_live_timezone: string | null;
          timezone: string | null;
          booking_interval_minutes: number | null;
          avg_rating: number;
          review_count: number;
          total_calls: number;
          next_available: string;
        } | {
          category: string;
          live_join_fee: number | null;
          scheduled_live_at: string | null;
          scheduled_live_timezone: string | null;
          timezone: string | null;
          booking_interval_minutes: number | null;
          avg_rating: number;
          review_count: number;
          total_calls: number;
          next_available: string;
        }[] | null;
      };

      const cp = Array.isArray(p.creator_profiles)
        ? p.creator_profiles[0]
        : p.creator_profiles;
      const activeSession = activeSessionByCreator[p.id];

      const packages = packagesByCreator[p.id] ?? [];
      const minPrice = packages.length
        ? Math.min(...packages.map((pkg: { price: number }) => Number(pkg.price)))
        : 0;

      return {
        id: p.id,
        name: p.full_name,
        username: `@${p.username}`,
        createdAt: p.created_at,
        bio: "",
        category: cp?.category ?? "",
        tags: [],
        followers: "",
        rating: Number(cp?.avg_rating ?? 0),
        reviewCount: Number(cp?.review_count ?? 0),
        avatarInitials: p.avatar_initials,
        avatarColor: p.avatar_color,
        avatarUrl: p.avatar_url ?? undefined,
        isLive: Boolean(activeSession),
        currentLiveSessionId: activeSession?.id ?? undefined,
        queueCount: queueCountByCreator[p.id] ?? 0,
        audienceCount: activeSession ? (audienceCountBySession[activeSession.id] ?? (queueCountByCreator[p.id] ?? 0) + 1) : 0,
        callPrice: minPrice,
        callDuration: packages[0]?.duration ?? 15,
        nextAvailable: minPrice > 0 ? (cp?.next_available ?? "Available this week") : "No packages yet",
        totalCalls: Number(cp?.total_calls ?? 0),
        responseTime: "",
        liveJoinFee: cp?.live_join_fee ? Number(cp.live_join_fee) : undefined,
        scheduledLiveAt: cp?.scheduled_live_at ?? undefined,
        scheduledLiveTimeZone: cp?.scheduled_live_timezone ?? cp?.timezone ?? undefined,
        bookingIntervalMinutes: cp?.booking_interval_minutes ? Number(cp.booking_interval_minutes) : 30,
        isNew: isNewCreator(p.created_at),
      };
    });

    setSavedCreators(creators);
    setLoading(false);
  }

  async function handleUnsave(creatorId: string) {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from("saved_creators")
      .delete()
      .eq("fan_id", user.id)
      .eq("creator_id", creatorId);
    setSavedCreators((prev) => prev.filter((c) => c.id !== creatorId));
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AccountRequired
        title="Make an account to save creators"
        description="Saved creators are tied to your account so you can come back to them from any device."
        next="/saved"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-3 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">Saved Creators</h1>
        <p className="text-brand-ink-subtle mt-1">
          Creators you&apos;ve saved for quick access.
        </p>
      </div>

      {/* Content */}
      {savedCreators.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
          <Heart className="w-12 h-12 text-brand-ink-subtle mx-auto mb-4" />
          <p className="text-lg font-semibold text-brand-ink-muted">No saved creators yet</p>
          <p className="text-sm text-brand-ink-subtle mt-1 mb-6">
            Heart a creator on their profile to save them here for later.
          </p>
          <Link href="/discover">
            <Button variant="primary" size="md" className="gap-2">
              <Compass className="w-4 h-4" />
              Discover Creators
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-brand-ink-subtle">
            {savedCreators.length} saved creator{savedCreators.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {savedCreators.map((creator) => (
              <div key={creator.id} className="relative group/saved">
                <InfluencerCard creator={creator} initialIsSaved={true} showSaveButton={false} />
                <button
                  onClick={() => handleUnsave(creator.id)}
                  className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-white/95 text-red-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                  title="Remove from saved"
                  aria-label={`Remove ${creator.name} from saved creators`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}
