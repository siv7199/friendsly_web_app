"use client";

import Link from "next/link";
import { Zap, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getLiveSessionPath } from "@/lib/routes";
import type { Creator } from "@/types";

interface LiveStageCardProps {
  creator: Creator;
}

export function LiveStageCard({ creator }: LiveStageCardProps) {
  const hasLiveRate = Boolean(creator.liveJoinFee && creator.liveJoinFee > 0);
  const liveAudienceCount = creator.queueCount + 1;
  const liveHref = getLiveSessionPath({
    creatorId: creator.id,
    creatorUsername: creator.username,
    sessionId: creator.currentLiveSessionId,
  });

  return (
    <Link href={liveHref} className="block shrink-0 group">
      <div className="relative w-[152px] h-[220px] rounded-2xl overflow-hidden bg-brand-dark shadow-md-light group-hover:shadow-lg-light group-hover:-translate-y-1 transition-all duration-200 ease-out-expo">

        {/* Background — deep purple gradient */}
        <div className="absolute inset-0 bg-gradient-dark" />
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(ellipse at 50% 30%, #6C5CE740 0%, transparent 70%)" }}
        />

        {/* Creator initials / photo */}
        {creator.avatarUrl ? (
          <img src={creator.avatarUrl} alt={creator.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-brand-primary/30 border-2 border-white/20 flex items-center justify-center">
            <span className="text-xl font-black text-white/90 font-display">{creator.avatarInitials}</span>
          </div>
        )}

        {/* Live badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-live text-white text-[9px] font-bold font-display uppercase tracking-widest">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Queue count */}
        {liveAudienceCount > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <Users className="w-2.5 h-2.5 text-white/70" />
            <span className="text-[10px] font-semibold text-white/80">{liveAudienceCount}</span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-stage px-3 pt-8 pb-3">
          <p className="text-white text-[13px] font-serif font-normal leading-tight truncate">{creator.name}</p>
          {creator.category && (
            <p className="text-white/55 text-[10px] mt-0.5 truncate">{creator.category}</p>
          )}
          <div className="flex items-center justify-between mt-2 gap-1">
            {hasLiveRate ? (
              <span className="text-[11px] font-bold text-brand-primary-light flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                {formatCurrency(creator.liveJoinFee!)} / min
              </span>
            ) : (
              <span className="text-[11px] text-white/40">Free</span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary text-white font-semibold font-display">
              Watch
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
