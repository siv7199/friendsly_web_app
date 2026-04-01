"use client";

/**
 * Discover Page  (route: /discover)
 *
 * The fan's main browsing page — a grid of creator cards.
 * All data comes from Supabase (profiles + creator_profiles + call_packages).
 */

import { useEffect, useState, useMemo } from "react";
import { Search, SlidersHorizontal, Zap, Loader2 } from "lucide-react";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/types";
import { formatCurrency } from "@/lib/utils";

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

// ── Fetch all creators from Supabase ──────────────────────────────────────────

async function fetchCreators(): Promise<Creator[]> {
  const supabase = createClient();

  // Get all creator profiles with their base profile data
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*, creator_profiles(*)")
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

  // Group packages by creator_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packagesByCreator: Record<string, any[]> = {};
  (allPackages ?? []).forEach((pkg: { creator_id: string; price: number; duration: number }) => {
    if (!packagesByCreator[pkg.creator_id]) packagesByCreator[pkg.creator_id] = [];
    packagesByCreator[pkg.creator_id]!.push(pkg);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return profiles.map((profile: any) => {
    const cp = Array.isArray(profile.creator_profiles)
      ? profile.creator_profiles[0]
      : profile.creator_profiles;

    const packages = packagesByCreator[profile.id] ?? [];
    const minPrice = packages.length
      ? Math.min(...packages.map((p: { price: number }) => Number(p.price)))
      : 0;
    const minDuration = packages.length ? packages[0].duration : 15;

    const hasPackages = minPrice > 0;
    const liveRate = cp?.live_rate_per_minute ? Number(cp.live_rate_per_minute) : undefined;

    return {
      id: profile.id,
      name: profile.full_name,
      username: `@${profile.username}`,
      bio: cp?.bio ?? "",
      category: cp?.category ?? "",
      tags: cp?.tags ?? [],
      followers: cp?.followers_count > 0 ? formatFollowers(cp.followers_count) : "New",
      rating: Number(cp?.avg_rating ?? 0),
      reviewCount: cp?.review_count ?? 0,
      avatarInitials: profile.avatar_initials,
      avatarColor: profile.avatar_color,
      avatarUrl: profile.avatar_url ?? undefined,
      isLive: cp?.is_live ?? false,
      queueCount: 0, // Will be populated from live_sessions later
      callPrice: minPrice,
      callDuration: minDuration,
      nextAvailable: hasPackages ? (cp?.next_available ?? "Available this week") : "No packages yet",
      totalCalls: cp?.total_calls ?? 0,
      responseTime: cp?.response_time ?? "~5 min",
      liveRatePerMinute: liveRate,
    } satisfies Creator;
  });
}

function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

export default function DiscoverPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    fetchCreators().then((data) => {
      setCreators(data);
      setLoading(false);
    });
  }, []);

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
              <InfluencerCard key={creator.id} creator={creator} />
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
              <InfluencerCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
