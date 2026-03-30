"use client";

/**
 * Discover Page  (route: /discover)
 *
 * The fan's main browsing page — a grid of influencer cards.
 * Includes filtering by category and a search bar.
 *
 * Real creators (signed up via onboarding) are loaded from localStorage
 * via getRegisteredCreators() and shown in a "New Creators" section above
 * the mock seed data.
 */

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, Zap, Sparkles } from "lucide-react";
import { InfluencerCard } from "@/components/fan/InfluencerCard";
import { MOCK_CREATORS } from "@/lib/mock-data";
import { getRegisteredCreators } from "@/lib/mock-auth";
import type { Creator } from "@/types";

const CATEGORIES = [
  "All", "Fitness & Wellness", "Business & Startups",
  "Content Creation", "Finance & Investing", "Beauty & Skincare", "Tech & Career",
];

export default function DiscoverPage() {
  const [registeredCreators, setRegisteredCreators] = useState<Creator[]>([]);

  useEffect(() => {
    setRegisteredCreators(getRegisteredCreators());
  }, []);

  const liveCreators = MOCK_CREATORS.filter((c) => c.isLive);

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
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              i === 0
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

      {/* ── New Creators Section (real signups) ── */}
      {registeredCreators.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <h2 className="text-lg font-bold text-slate-100">New Creators</h2>
            <span className="text-sm text-slate-500">Just joined the platform</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {registeredCreators.map((creator) => (
              <InfluencerCard key={creator.id} creator={creator} />
            ))}
          </div>
        </section>
      )}

      {/* ── All Creators ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">All Creators</h2>
          <span className="text-sm text-slate-500">{MOCK_CREATORS.length} available</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {MOCK_CREATORS.map((creator) => (
            <InfluencerCard key={creator.id} creator={creator} />
          ))}
        </div>
      </section>
    </div>
  );
}
