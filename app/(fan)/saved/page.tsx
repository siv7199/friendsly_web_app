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
           id, full_name, username, avatar_initials, avatar_color, avatar_url,
           creator_profiles(
             bio, category, tags, live_rate_per_minute, is_live,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packagesByCreator: Record<string, any[]> = {};
    (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
      if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
      packagesByCreator[pkg.creator_id]!.push(pkg);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators: Creator[] = saved.map((s: any) => {
      const profile = Array.isArray(s.creator) ? s.creator[0] : s.creator;
      const p = profile as {
        id: string;
        full_name: string;
        username: string;
        avatar_initials: string;
        avatar_color: string;
        avatar_url: string | null;
        creator_profiles: {
          bio: string;
          category: string;
          tags: string[];
          live_rate_per_minute: number | null;
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
          live_rate_per_minute: number | null;
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
        bio: cp?.bio ?? "",
        category: cp?.category ?? "",
        tags: cp?.tags ?? [],
        followers: (cp?.followers_count ?? 0) > 0
          ? formatFollowers(cp!.followers_count)
          : "New",
        rating: Number(cp?.avg_rating ?? 0),
        reviewCount: cp?.review_count ?? 0,
        avatarInitials: p.avatar_initials,
        avatarColor: p.avatar_color,
        avatarUrl: p.avatar_url ?? undefined,
        isLive: cp?.is_live ?? false,
        queueCount: 0,
        callPrice: minPrice,
        callDuration: packages[0]?.duration ?? 15,
        nextAvailable: minPrice > 0 ? (cp?.next_available ?? "Available this week") : "No packages yet",
        totalCalls: cp?.total_calls ?? 0,
        responseTime: cp?.response_time ?? "~5 min",
        liveRatePerMinute: cp?.live_rate_per_minute ? Number(cp.live_rate_per_minute) : undefined,
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
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-100">Saved Creators</h1>
        <p className="text-slate-400 mt-1">
          Creators you&apos;ve saved for quick access.
        </p>
      </div>

      {/* Content */}
      {savedCreators.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
          <Heart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-300">No saved creators yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">
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
          <p className="text-sm text-slate-500">
            {savedCreators.length} saved creator{savedCreators.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {savedCreators.map((creator) => (
              <div key={creator.id} className="relative group/saved">
                <InfluencerCard creator={creator} />
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
