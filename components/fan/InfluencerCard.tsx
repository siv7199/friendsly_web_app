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
      <article className="bg-white rounded-2xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ease-out-expo animate-card-enter group border border-brand-border/60">

        {/* ── Media area — large purple stage (matches reference) ── */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>

          {/* Purple gradient background — the signature card visual */}
          <div className="absolute inset-0 bg-gradient-card-media" />

          {/* Creator photo or centered avatar — fallback always rendered beneath */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn("w-20 h-20 rounded-full flex items-center justify-center", creator.avatarColor || "bg-white/25")}>
              <span className="text-3xl font-black text-white/90 font-display">
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

          {/* Live overlay — pulsing badge on the media area */}
          {creator.isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow-sm animate-badge-pop">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              <span className="text-[10px] font-bold text-brand-live font-display uppercase tracking-wider">Live</span>
            </div>
          )}

          {/* Queue count */}
          {creator.isLive && creator.queueCount > 0 && (
            <div className="absolute top-3 right-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
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
                "absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150",
                isSaved
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-white/80 text-brand-ink-subtle hover:bg-white hover:text-red-400 backdrop-blur-sm"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5", isSaved && "fill-current")} />
            </button>
          )}

          {/* New creator badge */}
          {creator.isNew && !creator.isLive && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-400/90 text-[10px] font-bold text-white font-display uppercase tracking-wide animate-badge-pop">
              New
            </div>
          )}

          {/* Bottom scrim — fades into white card below */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white/20 to-transparent" />
        </div>

        {/* ── Content area ── */}
        <div className="px-4 pt-3.5 pb-2 flex-1 flex flex-col gap-2">

          {/* Name row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/profile/${creator.id}`}
                className="text-base font-bold text-brand-ink hover:text-brand-primary transition-colors leading-tight font-display block"
              >
                {creator.name}
              </Link>
              <p className="text-[11px] text-brand-ink-subtle mt-0.5">{creator.username}</p>
            </div>
            {creator.category && (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand-elevated border border-brand-border text-brand-ink-muted font-display font-semibold">
                {creator.category}
              </span>
            )}
          </div>

          {/* Bio */}
          <p className="text-sm text-brand-ink-muted leading-relaxed line-clamp-2">
            {creator.bio || "This creator is just getting started."}
          </p>

          {/* Status row */}
          <div className="flex items-center gap-3">
            {creator.isLive ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                <span className="text-xs font-semibold text-brand-live">Live Now</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-amber-600">{creator.rating}</span>
                <span className="text-xs text-brand-ink-subtle">({creator.reviewCount})</span>
              </div>
            )}

            {!creator.isLive && countdownText && (
              <span className="text-[11px] text-brand-primary font-semibold">{countdownText}</span>
            )}

            {creator.isLive && hasLiveRate && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-primary ml-auto">
                <Zap className="w-2.5 h-2.5" />
                {formatCurrency(creator.liveJoinFee!)}/30s
              </span>
            )}
          </div>
        </div>

        {/* ── CTA footer — full-width button matching reference ── */}
        <div className="px-4 pb-4 pt-2">
          {creator.isLive && hasLiveRate ? (
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
          ) : creator.isLive && !hasLiveRate ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-full opacity-50 cursor-not-allowed"
              disabled
            >
              No rate set
            </Button>
          ) : hasPackages ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleOpenBooking()}
              className="w-full rounded-full font-display font-semibold group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary transition-all duration-200"
              disabled={isLoadingBookingData}
            >
              <Video className="w-3.5 h-3.5" />
              {isLoadingBookingData ? "Loading…" : `Book · ${formatCurrency(creator.callPrice)}`}
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
