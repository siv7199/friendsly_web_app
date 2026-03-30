"use client";

/**
 * Creator Dashboard  (route: /dashboard)
 *
 * The creator's home base — stats overview + recent bookings.
 */

import {
  DollarSign, Video, Star, Calendar,
  Users, TrendingUp, Radio, ArrowRight,
} from "lucide-react";
import { StatsCard } from "@/components/creator/StatsCard";
import { BookingList } from "@/components/creator/BookingList";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CREATOR_STATS, MOCK_BOOKINGS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import type { CreatorStats } from "@/types";
import { getCreatorPackages } from "@/lib/mock-auth";
import Link from "next/link";

const EMPTY_STATS: CreatorStats = {
  totalEarnings: 0,
  callsThisMonth: 0,
  avgRating: 0,
  upcomingBookings: 0,
  totalFans: 0,
  conversionRate: 0,
};

export default function DashboardPage() {
  const { user } = useAuthContext();

  // Only show mock data for the seeded demo creator (id "1" = Luna Vasquez).
  // Any real signed-up creator gets a clean zero state.
  const isDemo = user?.id === "1";
  const stats = isDemo ? MOCK_CREATOR_STATS : EMPTY_STATS;
  const upcomingBookings = isDemo
    ? MOCK_BOOKINGS.filter((b) => b.status === "upcoming")
    : [];
  const recentCompleted = isDemo
    ? MOCK_BOOKINGS.filter((b) => b.status === "completed").slice(0, 3)
    : [];

  const displayName = user?.full_name ?? "Creator";
  const displayUsername = user ? `@${user.username}` : "";
  const displayCategory = user && isCreatorProfile(user) ? user.category : "";
  const avatarInitials = user?.avatar_initials ?? "??";
  const avatarColor = user?.avatar_color ?? "bg-violet-600";

  // Calculate profile completeness score
  const profileStrength = (() => {
    if (!user) return 0;
    let score = 0;
    if (user.full_name) score += 20;
    if (user.username) score += 10;
    if (user.avatar_color) score += 5;
    if (user.avatar_url) score += 15;
    if (isCreatorProfile(user)) {
      if (user.bio) score += 25;
      if (user.category) score += 15;
      const pkgs = getCreatorPackages(user.id);
      if (pkgs.some((p) => p.isActive)) score += 10;
    }
    return score;
  })();

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">Good afternoon,</p>
          <h1 className="text-3xl font-black text-slate-100">{displayName} 👋</h1>
        </div>
        <Link href="/live">
          <Button variant="live" className="gap-2 shadow-glow-live">
            <Radio className="w-4 h-4" />
            Go Live
          </Button>
        </Link>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="Total Earnings"
          value={formatCurrency(stats.totalEarnings)}
          subtext="All time"
          trend={isDemo ? { value: "+18%", positive: true } : undefined}
          icon={<DollarSign className="w-5 h-5" />}
          accent="gold"
          className="col-span-2 xl:col-span-2"
        />
        <StatsCard
          title="Calls This Month"
          value={String(stats.callsThisMonth)}
          subtext={new Date().toLocaleString("default", { month: "long", year: "numeric" })}
          trend={isDemo ? { value: "+12", positive: true } : undefined}
          icon={<Video className="w-5 h-5" />}
          accent="primary"
        />
        <StatsCard
          title="Avg. Rating"
          value={stats.avgRating > 0 ? String(stats.avgRating) : "—"}
          subtext={stats.totalFans > 0 ? `From ${stats.totalFans} fans` : "No calls yet"}
          icon={<Star className="w-5 h-5" />}
          accent="gold"
        />
        <StatsCard
          title="Upcoming"
          value={String(stats.upcomingBookings)}
          subtext="Next 7 days"
          icon={<Calendar className="w-5 h-5" />}
          accent="info"
        />
        <StatsCard
          title="Conversion"
          value={`${stats.conversionRate}%`}
          subtext="View → book rate"
          trend={isDemo ? { value: "+2.1%", positive: true } : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="live"
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-100">Upcoming Bookings</h2>
            <Link href="/calendar" className="text-sm text-brand-primary-light hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <BookingList bookings={upcomingBookings} />
        </div>

        {/* Quick actions + profile card */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={avatarInitials} color={avatarColor} size="md" />
              <div>
                <p className="font-bold text-slate-100">{displayName}</p>
                <p className="text-xs text-slate-500">
                  {displayUsername}{displayCategory ? ` · ${displayCategory}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Profile strength</span>
                <span className="text-brand-live font-semibold">{profileStrength}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-brand-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-live transition-all"
                  style={{ width: `${profileStrength}%` }}
                />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-brand-elevated border border-brand-border text-xs text-slate-400">
              💡 Add a profile video to increase bookings by up to 30%.
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Manage Offerings", href: "/management", icon: "⚙️" },
                { label: "View Calendar", href: "/calendar", icon: "📅" },
                { label: "Update Availability", href: "/management", icon: "🕐" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-elevated border border-brand-border hover:border-brand-primary/40 transition-colors text-sm text-slate-300 hover:text-slate-100"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Completed ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-100">Recently Completed</h2>
          <Link href="/calendar" className="text-sm text-brand-primary-light hover:underline flex items-center gap-1">
            Full history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <BookingList bookings={recentCompleted} />
      </div>
    </div>
  );
}
