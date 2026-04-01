"use client";

import { useState, useEffect } from "react";
import { Star, Video, Clock, Users, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import type { Creator, CallPackage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface InfluencerCardProps {
  creator: Creator;
}

export function InfluencerCard({ creator }: InfluencerCardProps) {
  const [showBooking, setShowBooking] = useState(false);
  const [packages, setPackages] = useState<CallPackage[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("call_packages")
      .select("*")
      .eq("creator_id", creator.id)
      .eq("is_active", true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }, [creator.id]);

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
              size="lg"
              isLive={creator.isLive}
              className="cursor-pointer"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={`/profile/${creator.id}`}
                  className="text-base font-bold text-slate-100 hover:text-brand-primary-light transition-colors"
                >
                  {creator.name}
                </Link>
                <p className="text-sm text-slate-500">{creator.username}</p>
              </div>
              {creator.isLive && (
                <Badge variant="live" className="shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  LIVE
                </Badge>
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
          <Badge variant="primary" className="text-[11px]">{creator.category}</Badge>
        </div>

        {/* ── Bio ── */}
        <p className="px-5 pt-3 text-sm text-slate-400 leading-relaxed line-clamp-2 flex-1">
          {creator.bio}
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

          {creator.isLive ? (
            <Link href={`/waiting-room/${creator.id}`}>
              <Button variant="live" size="sm" className="gap-1.5 shrink-0">
                <Zap className="w-3.5 h-3.5" />
                Join Queue ({creator.queueCount})
              </Button>
            </Link>
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
      </article>

      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => setShowBooking(false)}
        packages={packages}
      />
    </>
  );
}
