"use client";

import { useState, useEffect } from "react";
import { Star, Video, Clock, Zap, Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import type { Creator, CallPackage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import Link from "next/link";

interface InfluencerCardProps {
  creator: Creator;
  initialIsSaved?: boolean;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

export function InfluencerCard({ creator, initialIsSaved = false }: InfluencerCardProps) {
  const { user } = useAuthContext();
  const [showBooking, setShowBooking] = useState(false);
  const [packages, setPackages] = useState<CallPackage[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingBookingData, setIsLoadingBookingData] = useState(false);
  const [countdownText, setCountdownText] = useState<string | null>(null);

  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);

  useEffect(() => {
    function updateCountdown() {
      if (!creator.scheduledLiveAt || creator.isLive) {
        setCountdownText(null);
        return;
      }
      const scheduledDate = new Date(creator.scheduledLiveAt);
      const diff = scheduledDate.getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText("Going live soon");
      } else {
        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        setCountdownText(hours > 0 ? `Live in ${hours}h ${minutes}m` : `Live in ${minutes}m`);
      }
    }
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60000);
    return () => window.clearInterval(interval);
  }, [creator.scheduledLiveAt, creator.scheduledLiveTimeZone, creator.timeZone, creator.isLive]);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setIsSaving(true);
    const supabase = createClient();
    if (isSaved) {
      await supabase.from("saved_creators").delete().eq("fan_id", user.id).eq("creator_id", creator.id);
      setIsSaved(false);
    } else {
      await supabase.from("saved_creators").insert({ fan_id: user.id, creator_id: creator.id });
      setIsSaved(true);
    }
    setIsSaving(false);
  }

  async function loadBookingData() {
    if (packages.length > 0 || availability.length > 0 || isLoadingBookingData) return;
    setIsLoadingBookingData(true);
    const supabase = createClient();
    try {
      const [{ data: packageData }, { data: availabilityData, error: availabilityError }] = await Promise.all([
        supabase.from("call_packages").select("*").eq("creator_id", creator.id).eq("is_active", true),
        supabase.from("creator_availability").select("day_of_week, start_time, end_time, package_id").eq("creator_id", creator.id).eq("is_active", true),
      ]);
      if (packageData) {
        setPackages(packageData.map((p: any) => ({
          id: p.id,
          name: p.name,
          duration: p.duration,
          price: Number(p.price),
          description: p.description,
          isActive: p.is_active,
          bookingsCount: p.bookings_count,
        })));
      }
      if (availabilityData && !availabilityError) setAvailability(availabilityData);
    } finally {
      setIsLoadingBookingData(false);
    }
  }

  async function handleOpenBooking() {
    setShowBooking(true);
    await loadBookingData();
  }

  const hasLiveRate = Boolean(creator.liveJoinFee && creator.liveJoinFee > 0);
  const hasPackages  = creator.callPrice > 0 || packages.length > 0;

  return (
    <>
      <article className="bg-white rounded-[18px] overflow-hidden flex flex-col shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ease-out-expo animate-card-enter group border border-brand-border/50">

        {/* ── Media area — 1:1 square photo (Intro.co style) ── */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "1/1" }}>
          {/* Clickable overlay for navigation */}
          <Link href={`/profile/${creator.id}`} className="absolute inset-0 z-0" aria-label={`View ${creator.name}'s profile`} />

          {/* Purple gradient background */}
          <div className="absolute inset-0 bg-gradient-card-media" />

          {/* Creator photo or centered avatar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center ring-4 ring-white/50 shadow-lg", creator.avatarColor || "bg-white/25")}>
              <span className="text-2xl font-black text-white/90 font-display">
                {creator.avatarInitials}
              </span>
            </div>
          </div>
          {creator.avatarUrl && (
            <img
              src={creator.avatarUrl}
              alt={creator.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {/* Live badge */}
          {creator.isLive && (
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow-sm animate-badge-pop">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              <span className="text-[10px] font-bold text-brand-live font-display uppercase tracking-wider">Live</span>
            </div>
          )}

          {/* Queue count */}
          {creator.isLive && creator.queueCount > 0 && (
            <div className="absolute top-2.5 right-10 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
              <Users className="w-2.5 h-2.5 text-white/80" />
              <span className="text-[10px] font-semibold text-white/90">{creator.queueCount}</span>
            </div>
          )}

          {/* Save button */}
          {user && (
            <button
              onClick={toggleSave}
              disabled={isSaving}
              className={cn(
                "absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150",
                isSaved
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-white/80 text-brand-ink-subtle hover:bg-white hover:text-red-400 backdrop-blur-sm"
              )}
            >
              <Heart className={cn("w-3 h-3", isSaved && "fill-current")} />
            </button>
          )}

          {/* New badge */}
          {creator.isNew && !creator.isLive && (
            <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full bg-amber-400/90 text-[10px] font-bold text-white font-display uppercase tracking-wide animate-badge-pop">
              New
            </div>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="px-3.5 pt-3 pb-2.5 flex-1 flex flex-col gap-1">

          {/* Category above name — Intro.co pattern */}
          {creator.category && (
            <p className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-brand-ink-subtle">
              {creator.category}
            </p>
          )}

          {/* Name */}
          <Link
            href={`/profile/${creator.id}`}
            className="text-[15px] font-serif font-normal text-brand-ink hover:text-brand-primary transition-colors leading-tight"
          >
            {creator.name}
          </Link>

          {/* Price + rating row */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {creator.isLive ? (
                <>
                  {hasLiveRate && (
                    <span className="text-sm font-display font-bold text-brand-live shrink-0">
                      {formatCurrency(creator.liveJoinFee!)}
                      <span className="font-normal text-brand-ink-subtle text-[11px]"> /min</span>
                    </span>
                  )}
                  {hasPackages && (
                    <span className="text-[11px] text-brand-ink-subtle truncate">
                      · Book from {formatCurrency(creator.callPrice)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {hasPackages && (
                    <span className="text-sm font-display font-bold text-brand-ink shrink-0">
                      {formatCurrency(creator.callPrice)}
                      <span className="font-normal text-brand-ink-subtle text-[11px]"> /call</span>
                    </span>
                  )}
                  {countdownText && (
                    <span className="text-[10px] text-brand-primary font-semibold truncate">{countdownText}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-amber-600">
                {creator.rating > 0 ? creator.rating : "New"}
              </span>
              {creator.rating > 0 && (
                <span className="text-[10px] text-brand-ink-subtle">({creator.reviewCount})</span>
              )}
            </div>
          </div>
        </div>

        {/* ── CTA footer ── */}
        <div className="px-3.5 pb-3.5">
          {creator.isLive ? (
            <div className="space-y-1.5">
              {hasLiveRate ? (
                <Link href={`/waiting-room/${creator.id}`} className="block">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full rounded-full font-display font-semibold tracking-wide"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Join Live
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full opacity-50 cursor-not-allowed"
                  disabled
                >
                  Live · No rate set
                </Button>
              )}
              {hasPackages && (
                <button
                  onClick={() => void handleOpenBooking()}
                  disabled={isLoadingBookingData}
                  className="w-full text-center text-[11px] font-display font-semibold text-brand-ink-subtle hover:text-brand-primary transition-colors py-0.5 disabled:opacity-50"
                >
                  {isLoadingBookingData ? "Loading…" : `Book from ${formatCurrency(creator.callPrice)} →`}
                </button>
              )}
            </div>
          ) : hasPackages ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleOpenBooking()}
              className="w-full rounded-full font-display font-semibold group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary transition-all duration-200"
              disabled={isLoadingBookingData}
            >
              <Video className="w-3.5 h-3.5 group-hover:hidden" />
              <span className="group-hover:hidden">
                {isLoadingBookingData ? "Loading…" : `Book from ${formatCurrency(creator.callPrice)}`}
              </span>
              <span className="hidden group-hover:inline">
                {isLoadingBookingData ? "Loading…" : "See times →"}
              </span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="w-full rounded-full opacity-50 font-display"
            >
              <Clock className="w-3.5 h-3.5" />
              Coming Soon
            </Button>
          )}
        </div>
      </article>

      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => setShowBooking(false)}
        packages={packages}
        availability={availability}
      />
    </>
  );
}
