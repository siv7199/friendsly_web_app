"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  BookOpen,
  CreditCard,
  Heart,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { createClient } from "@/lib/supabase/client";

const LIVE_SESSION_STALE_MS = 45000;
const LIVE_COUNT_REFRESH_MS = 60000;

const NAV_ITEMS = [
  { label: "Discover",    href: "/discover",  icon: Compass },
  { label: "My Bookings", href: "/bookings",  icon: BookOpen },
  { label: "Payments",    href: "/payments",  icon: CreditCard },
  { label: "Saved",       href: "/saved",     icon: Heart },
];

export function FanSidebar() {
  const pathname = usePathname();
  const [liveCount, setLiveCount] = useState(0);
  const liveExpiryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function getCount() {
      if (liveExpiryTimeoutRef.current) {
        window.clearTimeout(liveExpiryTimeoutRef.current);
        liveExpiryTimeoutRef.current = null;
      }

      const heartbeatCutoffIso = new Date(Date.now() - LIVE_SESSION_STALE_MS).toISOString();
      const { data } = await supabase
        .from("live_sessions")
        .select("id, creator_id, last_heartbeat_at")
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .gte("last_heartbeat_at", heartbeatCutoffIso);

      const uniqueLiveCreators = new Set((data ?? []).map((session: any) => session.creator_id));
      setLiveCount(uniqueLiveCreators.size);

      const activeSessions = (data ?? []) as { last_heartbeat_at?: string | null }[];
      const nextExpiryDelay = activeSessions.reduce<number | null>((soonestDelay, session) => {
        if (!session.last_heartbeat_at) return soonestDelay;
        const delay = Math.max(
          1000,
          LIVE_SESSION_STALE_MS - (Date.now() - new Date(session.last_heartbeat_at).getTime()) + 1000
        );
        return soonestDelay == null ? delay : Math.min(soonestDelay, delay);
      }, null);

      if (nextExpiryDelay != null) {
        liveExpiryTimeoutRef.current = window.setTimeout(refreshIfVisible, nextExpiryDelay);
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") void getCount();
    }

    void getCount();

    const fallbackInterval = window.setInterval(refreshIfVisible, LIVE_COUNT_REFRESH_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      if (liveExpiryTimeoutRef.current) window.clearTimeout(liveExpiryTimeoutRef.current);
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);

  return (
    <aside className="hidden w-[220px] shrink-0 self-start fan-rail animate-rail-enter md:sticky md:top-0 md:flex md:h-screen md:flex-col">

      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-brand-border/60">
        <BrandLogo subtitle="Fan" theme="light" />
      </div>

      {/* Live now indicator */}
      {liveCount > 0 && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-live/8 border border-brand-live/20 animate-badge-pop">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse shrink-0" />
          <span className="text-xs text-brand-live font-semibold font-display tracking-wide">{liveCount} live now</span>
          <Radio className="w-3 h-3 text-brand-live ml-auto opacity-70" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-gradient-primary text-white shadow-nav-active"
                  : "text-brand-ink-muted hover:text-brand-ink hover:bg-brand-elevated"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "opacity-90" : "")} />
              <span className={cn("font-display", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
