"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  BookOpen,
  CreditCard,
  Heart,
  Radio,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { GuestAuthModal } from "@/components/shared/GuestAuthModal";

const LIVE_SESSION_STALE_MS = 45000;
const LIVE_COUNT_REFRESH_MS = 60000;

const NAV_ITEMS = [
  { label: "Discover",    href: "/discover",  icon: Compass },
  { label: "My Bookings", href: "/bookings",  icon: BookOpen },
  { label: "Payments",    href: "/payments",  icon: CreditCard },
  { label: "Saved",       href: "/saved",     icon: Heart },
  { label: "Settings",    href: "/settings",  icon: Settings },
];

const ACCOUNT_ONLY_HREFS = new Set(["/bookings", "/payments", "/saved", "/settings"]);

export function FanSidebar() {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const [liveCount, setLiveCount] = useState(0);
  const [authNext, setAuthNext] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function getCount() {
      if (document.visibilityState !== "visible") return;
      const heartbeatCutoffIso = new Date(Date.now() - LIVE_SESSION_STALE_MS).toISOString();
      const { data } = await supabase
        .from("live_sessions")
        .select("creator_id")
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .gte("last_heartbeat_at", heartbeatCutoffIso);

      if (cancelled) return;
      const uniqueLiveCreators = new Set((data ?? []).map((session: any) => session.creator_id));
      setLiveCount(uniqueLiveCreators.size);
    }

    void getCount();
    const interval = window.setInterval(getCount, LIVE_COUNT_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <aside className="hidden w-[220px] shrink-0 fan-rail animate-rail-enter md:sticky md:top-0 md:flex md:h-screen md:flex-col md:self-stretch">

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
          const requiresAccount = !user && ACCOUNT_ONLY_HREFS.has(item.href);
          const className = cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            isActive
              ? "bg-gradient-primary text-white shadow-nav-active"
              : "text-brand-ink-muted hover:text-brand-ink hover:bg-brand-elevated"
          );
          const content = (
            <>
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "opacity-90" : "")} />
              <span className={cn("font-display", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
            </>
          );
          if (requiresAccount) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setAuthNext(item.href)}
                className={cn(className, "w-full text-left")}
              >
                {content}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <GuestAuthModal
        open={Boolean(authNext)}
        onClose={() => setAuthNext(null)}
        next={authNext ?? undefined}
        reason="Make an account to use this area."
      />
    </aside>
  );
}
