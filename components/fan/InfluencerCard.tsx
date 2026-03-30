"use client";

import { useState, useEffect } from "react";
import { Star, Video, Clock, Users, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import type { Creator, CallPackage } from "@/types";
import { getCreatorPackages } from "@/lib/mock-auth";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface InfluencerCardProps {
  creator: Creator;
}

export function InfluencerCard({ creator }: InfluencerCardProps) {
  const [showBooking, setShowBooking] = useState(false);
  const [packages, setPackages] = useState<CallPackage[]>([]);

  useEffect(() => {
    const pkgs = getCreatorPackages(creator.id).filter((p) => p.isActive);
    setPackages(pkgs);
  }, [creator.id]);

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

            {/* Rating + Reviews */}
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
        <div className="px-5 py-4 mt-3 border-t border-brand-border flex items-center justify-between">
          <div>
            {creator.callPrice > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-100">
                  {formatCurrency(creator.callPrice)}
                </span>
                <span className="text-xs text-slate-500">/ {creator.callDuration} min</span>
              </div>
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
              <Button variant="live" size="sm" className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Join Queue ({creator.queueCount})
              </Button>
            </Link>
          ) : creator.callPrice > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowBooking(true)}
              className="gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              Book Call
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="gap-1.5 opacity-50 cursor-not-allowed"
            >
              <Clock className="w-3.5 h-3.5" />
              Coming Soon
            </Button>
          )}
        </div>
      </article>

      {/* Booking Modal */}
      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => setShowBooking(false)}
        packages={packages}
      />
    </>
  );
}
