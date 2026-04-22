"use client";

import { useState, useEffect } from "react";
import { Star, Video, Clock, Zap, Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import type { Creator, CallPackage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getCreatorProfilePath, getLiveSessionPath } from "@/lib/routes";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface InfluencerCardProps {
  creator: Creator;
  initialIsSaved?: boolean;
  showSaveButton?: boolean;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

export function InfluencerCard({ creator, initialIsSaved = false, showSaveButton = true }: InfluencerCardProps) {
  const router = useRouter();
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
  const liveAudienceCount = creator.isLive ? creator.queueCount + 1 : creator.queueCount;
  const profileHref = getCreatorProfilePath({ id: creator.id, username: creator.username });
  const liveHref = getLiveSessionPath({
    creatorId: creator.id,
    creatorUsername: creator.username,
    sessionId: creator.currentLiveSessionId,
  });

  function shouldIgnoreCardNavigation(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("a, button, input, textarea, select, summary, [role='button'], [data-no-card-nav='true']")
    );
  }

  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    if (shouldIgnoreCardNavigation(event.target)) return;
    router.push(profileHref);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (shouldIgnoreCardNavigation(event.target)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(profileHref);
    }
  }

  return (
    <>
      <article
        className="group grid h-full min-h-[396px] cursor-pointer grid-rows-[auto_minmax(112px,1fr)_auto] overflow-hidden rounded-[18px] border border-brand-border/50 bg-white shadow-card transition-all duration-200 ease-out-expo animate-card-enter hover:-translate-y-0.5 hover:shadow-card-hover"
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="link"
        tabIndex={0}
        aria-label={`Open ${creator.name}'s profile`}
      >

        {/* ── Media area — 1:1 square photo (Intro.co style) ── */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "1/1" }}>
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

          {(creator.isLive && liveAudienceCount > 0) || (user && showSaveButton) ? (
            <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
              {creator.isLive && liveAudienceCount > 0 ? (
                <div className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
                  <Users className="h-2.5 w-2.5 text-white/80" />
                  <span className="text-[10px] font-semibold text-white/90">{liveAudienceCount}</span>
                </div>
              ) : null}

              {user && showSaveButton ? (
                <button
                  onClick={toggleSave}
                  disabled={isSaving}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150",
                    isSaved
                      ? "bg-red-500 text-white shadow-sm"
                      : "bg-white/80 text-brand-ink-subtle hover:bg-white hover:text-red-400 backdrop-blur-sm"
                  )}
                >
                  <Heart className={cn("h-3 w-3", isSaved && "fill-current")} />
                </button>
              ) : null}
            </div>
          ) : null}

          {/* New badge */}
          {creator.isNew && !creator.isLive && (
            <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full bg-amber-400/90 text-[10px] font-bold text-white font-display uppercase tracking-wide animate-badge-pop">
              New
            </div>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="flex min-h-0 flex-col gap-1 px-3.5 pb-2.5 pt-3">

          {/* Category above name — Intro.co pattern */}
          <p className="min-h-[14px] text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-brand-ink-subtle">
            {creator.category || "\u00A0"}
          </p>

          {/* Name */}
          <Link
            href={profileHref}
            className="line-clamp-2 min-h-[38px] text-[15px] font-serif font-normal leading-tight text-brand-ink transition-colors hover:text-brand-primary"
          >
            {creator.name}
          </Link>

          {/* Price + rating row */}
          <div className="mt-auto flex min-h-[34px] items-center justify-between gap-1">
            <div className="flex min-w-0 overflow-hidden items-center gap-2">
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
        <div className="mt-auto px-3.5 pb-3.5">
          {creator.isLive ? (
            <div className="flex min-h-[58px] flex-col justify-end space-y-1.5">
              {hasLiveRate ? (
                <Link href={liveHref} className="block">
                  <Button
                    variant="live"
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
              className="min-h-[34px] w-full rounded-full font-display font-semibold transition-all duration-200 group-hover:border-brand-primary group-hover:bg-brand-primary group-hover:text-white"
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
