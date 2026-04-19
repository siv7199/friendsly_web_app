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
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/types";
import { isNewCreator } from "@/lib/creators";

export default function SavedPage() {
  const { user } = useAuthContext();
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
              bio, category, tags, live_join_fee, is_live, booking_interval_minutes,
              scheduled_live_at, scheduled_live_timezone, timezone,
              followers_count, avg_rating, review_count, total_calls,
              response_time, next_available
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
          bio: string;
          category: string;
          tags: string[];
            live_join_fee: number | null;
            scheduled_live_at: string | null;
            scheduled_live_timezone: string | null;
            timezone: string | null;
            booking_interval_minutes: number | null;
            is_live: boolean;
          followers_count: number;
          avg_rating: number;
          review_count: number;
          total_calls: number;
          response_time: string;
          next_available: string;
        } | {
          bio: string;
          category: string;
          tags: string[];
            live_join_fee: number | null;
            scheduled_live_at: string | null;
            scheduled_live_timezone: string | null;
            timezone: string | null;
            booking_interval_minutes: number | null;
            is_live: boolean;
          followers_count: number;
          avg_rating: number;
          review_count: number;
          total_calls: number;
          response_time: string;
          next_available: string;
        }[] | null;
      };

      const cp = Array.isArray(p.creator_profiles)
        ? p.creator_profiles[0]
        : p.creator_profiles;

      const packages = packagesByCreator[p.id] ?? [];
      const minPrice = packages.length
        ? Math.min(...packages.map((pkg: { price: number }) => Number(pkg.price)))
        : 0;

      return {
        id: p.id,
        name: p.full_name,
        username: `@${p.username}`,
        createdAt: p.created_at,
        bio: cp?.bio ?? "",
        category: cp?.category ?? "",
        tags: cp?.tags ?? [],
        followers: "",
        rating: Number(cp?.avg_rating ?? 0),
        reviewCount: reviewCountByCreator[p.id] ?? 0,
        avatarInitials: p.avatar_initials,
        avatarColor: p.avatar_color,
        avatarUrl: p.avatar_url ?? undefined,
        isLive: cp?.is_live ?? false,
        queueCount: 0,
        callPrice: minPrice,
        callDuration: packages[0]?.duration ?? 15,
        nextAvailable: minPrice > 0 ? (cp?.next_available ?? "Available this week") : "No packages yet",
        totalCalls: totalCallsByCreator[p.id] ?? 0,
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
                <InfluencerCard creator={creator} initialIsSaved={true} />
                <button
                  onClick={() => handleUnsave(creator.id)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-brand-surface/90 border border-brand-border text-red-400 opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 hover:border-red-500/30 transition-all z-10"
                  title="Remove from saved"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
