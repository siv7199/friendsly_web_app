"use client";

/**
 * Creator Profile Page  (route: /profile/[id])
 *
 * [id] is a "dynamic segment" — Next.js will match any URL like
 * /profile/1, /profile/2, etc. and pass the id as a param.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Star, Users, Video, Clock, ArrowLeft,
  CheckCircle2, Zap, MessageSquare,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/fan/BookingModal";
import { MOCK_CREATORS } from "@/lib/mock-data";
import { getRegisteredCreators, getCreatorPackages } from "@/lib/mock-auth";
import type { CallPackage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";

// Looks up mock creators first, then real registered creators
function getCreator(id: string) {
  return (
    MOCK_CREATORS.find((c) => c.id === id) ??
    getRegisteredCreators().find((c) => c.id === id)
  );
}

// Demo reviews — only shown for the seeded mock creators (numeric IDs "1"–"6")
const MOCK_REVIEWS = [
  {
    id: "r1",
    fan: "Jordan K.",
    initials: "JK",
    color: "bg-violet-500",
    rating: 5,
    comment: "Incredibly prepared — gave me a full 6-week program during the call. Worth every dollar.",
    date: "2 days ago",
  },
  {
    id: "r2",
    fan: "Priya S.",
    initials: "PS",
    color: "bg-pink-500",
    rating: 5,
    comment: "She remembered everything I mentioned in my topic message. So professional, booked a follow-up immediately.",
    date: "1 week ago",
  },
  {
    id: "r3",
    fan: "Sam N.",
    initials: "SN",
    color: "bg-sky-500",
    rating: 4,
    comment: "Really good advice. Call went a bit over time which was a nice bonus. Will be back!",
    date: "2 weeks ago",
  },
];

export default function ProfilePage({ params }: { params: { id: string } }) {
  const creator = getCreator(params.id);
  const [showBooking, setShowBooking] = useState(false);

  if (!creator) return notFound();

  // Only show mock reviews for the seeded demo creators (ids "1"–"6")
  const isMockCreator = ["1", "2", "3", "4", "5", "6"].includes(params.id);
  const reviews = isMockCreator ? MOCK_REVIEWS : [];

  // Load real packages for this creator from localStorage
  const creatorPackages: CallPackage[] = getCreatorPackages(params.id);
  const activePackages = creatorPackages.filter((p) => p.isActive);
  const hasPackages = activePackages.length > 0;

  return (
    <>
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
        {/* ── Back ── */}
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>

        {/* ── Profile Hero ── */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
          {/* Header gradient banner */}
          <div className="h-24 bg-gradient-to-br from-brand-primary/30 to-purple-900/20" />

          {/* Profile content */}
          <div className="px-6 pb-6">
            {/* Avatar — overlaps the banner */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              <Avatar
                initials={creator.avatarInitials}
                color={creator.avatarColor}
                size="xl"
                isLive={creator.isLive}
                className="border-4 border-brand-surface"
              />
              {creator.isLive && (
                <Badge variant="live" className="mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  LIVE NOW
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-black text-slate-100">{creator.name}</h1>
            <p className="text-slate-400 text-sm">{creator.username}</p>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
                <span className="font-bold text-brand-gold">{creator.rating}</span>
                <span className="text-sm text-slate-500">({creator.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-400">
                <Users className="w-4 h-4" />
                <span>{creator.followers} followers</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-400">
                <Video className="w-4 h-4" />
                <span>{creator.totalCalls} calls completed</span>
              </div>
            </div>

            <p className="mt-4 text-slate-300 leading-relaxed">{creator.bio}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {creator.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1.5 rounded-full bg-brand-elevated border border-brand-border text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Booking Panel ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Packages list */}
          <div className="md:col-span-2 rounded-2xl border border-brand-border bg-brand-surface p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Available Sessions</h2>
            {!hasPackages ? (
              <div className="p-4 rounded-xl border border-brand-border bg-brand-elevated text-center py-8">
                <p className="text-slate-400 text-sm">No packages available yet.</p>
                <p className="text-slate-500 text-xs mt-1">This creator hasn&apos;t set up call packages yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePackages.map((pkg) => (
                  <div key={pkg.id} className="p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-100">{pkg.name}</p>
                        <p className="text-sm text-slate-400 mt-1">{pkg.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{pkg.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />Reply ~{creator.responseTime}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xl font-black text-gradient-gold">{formatCurrency(pkg.price)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA card */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex flex-col gap-4">
            <div className="text-center">
              {hasPackages ? (
                <>
                  <p className="text-2xl font-black text-slate-100">
                    {formatCurrency(Math.min(...activePackages.map((p) => p.price)))}
                  </p>
                  <p className="text-sm text-slate-500">starting price</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">No packages yet</p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {["Video call via Daily.co", "Instant booking confirmation", "Cancel up to 24h before"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-brand-live shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {creator.isLive ? (
              <Link href={`/waiting-room/${creator.id}`}>
                <Button variant="live" size="lg" className="w-full gap-2">
                  <Zap className="w-4 h-4" />
                  Join Queue — {creator.queueCount} ahead
                </Button>
              </Link>
            ) : hasPackages ? (
              <Button variant="gold" size="lg" className="w-full" onClick={() => setShowBooking(true)}>
                Book a Call
              </Button>
            ) : (
              <Button variant="ghost" size="lg" className="w-full opacity-50 cursor-not-allowed" disabled>
                Coming Soon
              </Button>
            )}

            <p className="text-[11px] text-center text-slate-600">
              Next available: {creator.nextAvailable}
            </p>
          </div>
        </div>

        {/* ── Reviews ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-100">
              Reviews <span className="text-slate-500 font-normal">({creator.reviewCount})</span>
            </h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${
                    n <= Math.round(creator.rating)
                      ? "fill-brand-gold text-brand-gold"
                      : "text-slate-600"
                  }`}
                />
              ))}
              <span className="ml-2 text-sm font-bold text-brand-gold">{creator.rating}</span>
            </div>
          </div>

          {reviews.length === 0 && (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
              <Star className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No reviews yet.</p>
              <p className="text-slate-500 text-sm mt-1">Be the first to book a call!</p>
            </div>
          )}
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-brand-border bg-brand-surface p-5"
              >
                <div className="flex items-start gap-3">
                  <Avatar initials={review.initials} color={review.color} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-100">{review.fan}</p>
                      <span className="text-xs text-slate-500">{review.date}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5 mb-2">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{review.comment}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BookingModal
        creator={creator}
        open={showBooking}
        onClose={() => setShowBooking(false)}
        packages={activePackages}
      />
    </>
  );
}
