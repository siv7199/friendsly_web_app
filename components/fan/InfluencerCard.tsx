"use client";

import { useState, useEffect } from "react";
import { Star, Video, Clock, Users, Zap, Heart } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import { LiveJoinModal } from "@/components/fan/LiveJoinModal";
import type { Creator, CallPackage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import Link from "next/link";

interface InfluencerCardProps {
  creator: Creator;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

export function InfluencerCard({ creator }: InfluencerCardProps) {
  const { user } = useAuthContext();
  const [showBooking, setShowBooking] = useState(false);
  const [showLiveJoin, setShowLiveJoin] = useState(false);
  const [packages, setPackages] = useState<CallPackage[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    // 1. Load packages
    supabase
      .from("call_packages")
      .select("*")
      .eq("creator_id", creator.id)
      .eq("is_active", true)
      .then(({ data }: any) => {
        if (data) {
          setPackages(data.map((p: any) => ({
            id: p.id,
            name: p.name,
            duration: p.duration,
            price: Number(p.price),
            description: p.description,
            isActive: p.is_active,
            bookingsCount: p.bookings_count,
          })));
        }
      });

    // 2. Load availability for booking modal parity with profile page
    supabase
      .from("creator_availability")
      .select("day_of_week, start_time, end_time, package_id")
      .eq("creator_id", creator.id)
      .eq("is_active", true)
      .then(({ data, error }: any) => {
        if (data && !error) {
          setAvailability(data);
          return;
        }

        supabase
          .from("creator_availability")
          .select("day_of_week, start_time, end_time")
          .eq("creator_id", creator.id)
          .eq("is_active", true)
          .then(({ data: fallbackData }: any) => {
            if (fallbackData) {
              setAvailability(fallbackData.map((slot: any) => ({ ...slot, package_id: null })));
            }
          });
      });

    // 3. Check if saved
    if (user) {
      supabase
        .from("saved_creators")
        .select("id")
        .eq("fan_id", user.id)
        .eq("creator_id", creator.id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) setIsSaved(true);
        });
    }
  }, [creator.id, user]);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return; // Maybe show login modal?

    setIsSaving(true);
    const supabase = createClient();

    if (isSaved) {
      await supabase
        .from("saved_creators")
        .delete()
        .eq("fan_id", user.id)
        .eq("creator_id", creator.id);
      setIsSaved(false);
    } else {
      await supabase
        .from("saved_creators")
        .insert({ fan_id: user.id, creator_id: creator.id });
      setIsSaved(true);
    }
    setIsSaving(false);
  }

  const hasLiveRate = Boolean(creator.liveRatePerMinute && creator.liveRatePerMinute > 0);
  const hasPackages  = creator.callPrice > 0 || packages.length > 0;

  return (
    <>
      <article className="glass-card rounded-2xl overflow-hidden group hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col">
        {/* ── Card Header ── */}
        <div className="p-5 flex items-start gap-4">
          <Link href={`/profile/${creator.id}`}>
            <Avatar
              initials={creator.avatarInitials}
              color={creator.avatarColor}
              imageUrl={creator.avatarUrl}
              size="lg"
              isLive={creator.isLive}
              className="cursor-pointer"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${creator.id}`}
                    className="text-base font-bold text-slate-100 hover:text-brand-primary-light transition-colors"
                  >
                    {creator.name}
                  </Link>
                  {creator.isNew && (
                    <Badge variant="gold" className="text-[10px] uppercase tracking-wide">
                      New
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">{creator.username}</p>
              </div>
              {creator.isLive && (
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="live" className="shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                    LIVE
                  </Badge>
                  <button
                    onClick={toggleSave}
                    disabled={isSaving}
                    className={cn(
                      "p-2 rounded-full transition-all",
                      isSaved ? "text-red-500 bg-red-500/10" : "text-slate-500 hover:text-slate-300 bg-slate-800/50"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
                  </button>
                </div>
              )}
              {!creator.isLive && (
                <button
                  onClick={toggleSave}
                  disabled={isSaving}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    isSaved ? "text-red-500 bg-red-500/10" : "text-slate-500 hover:text-slate-300 bg-slate-800/50"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
                </button>
              )}
            </div>

            {/* Rating + Followers */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
                <span className="text-xs font-semibold text-brand-gold">{creator.rating}</span>
                <span className="text-xs text-slate-500">({creator.reviewCount})</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Users className="w-3 h-3" />
                <span className="text-xs">{creator.followers}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category Tag ── */}
        <div className="px-5">
          <Badge variant="primary" className="text-[11px]">
            {creator.category || "New Creator"}
          </Badge>
        </div>

        {/* ── Bio ── */}
        <p className="px-5 pt-3 text-sm text-slate-400 leading-relaxed line-clamp-2 flex-1">
          {creator.bio || "No bio set yet. This creator is just getting started!"}
        </p>

        {/* ── Tags ── */}
        <div className="px-5 pt-3 flex flex-wrap gap-1.5">
          {creator.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-brand-elevated border border-brand-border text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* ── Pricing / Availability ── */}
        <div className="px-5 py-4 mt-3 border-t border-brand-border flex items-center justify-between gap-3">
          <div>
            {/* Live rate takes priority when creator is live */}
            {creator.isLive && hasLiveRate ? (
              <>
                <div className="flex items-baseline gap-1">
                  <Zap className="w-3.5 h-3.5 text-brand-live" />
                  <span className="text-xl font-black text-brand-live">
                    {formatCurrency(creator.liveRatePerMinute!)}
                  </span>
                  <span className="text-xs text-slate-500">/ min</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Pay only for time on call</p>
              </>
            ) : hasPackages ? (
              <>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Starts at</span>
                  <span className="text-2xl font-black text-slate-100 leading-none">
                    {formatCurrency(creator.callPrice)}
                  </span>
                </div>
                {hasLiveRate && (
                  <p className="text-[11px] text-brand-live mt-0.5">
                    <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                    Live: {formatCurrency(creator.liveRatePerMinute!)}/min
                  </p>
                )}
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-400">Packages TBD</span>
            )}
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>{creator.nextAvailable}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {creator.isLive && hasPackages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBooking(true)}
                className="shrink-0 px-2.5"
                title="Book Call"
              >
                <Video className="w-4 h-4" />
              </Button>
            )}

            {creator.isLive && hasLiveRate ? (
              <Button variant="live" size="sm" onClick={() => setShowLiveJoin(true)} className="gap-1.5 shrink-0">
                <Zap className="w-3.5 h-3.5" />
                Join Queue
              </Button>
            ) : creator.isLive && !hasLiveRate ? (
              <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-60 cursor-not-allowed">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs truncate">No Rate Set</span>
              </Button>
            ) : hasPackages ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBooking(true)}
                className="gap-1.5 shrink-0"
              >
                <Video className="w-3.5 h-3.5" />
                Book Call
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="gap-1.5 opacity-50 cursor-not-allowed shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                Coming Soon
              </Button>
            )}
          </div>
        </div>
      </article>

      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => setShowBooking(false)}
        packages={packages}
        availability={availability}
      />
      
      {creator.liveRatePerMinute && (
        <LiveJoinModal
          creator={creator}
          open={showLiveJoin}
          onClose={() => setShowLiveJoin(false)}
        />
      )}
    </>
  );
}
