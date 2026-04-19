"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  BookOpen,
  CreditCard,
  Heart,
  Settings,
  LogOut,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

const LIVE_SESSION_STALE_MS = 45000;

const NAV_ITEMS = [
  { label: "Discover",    href: "/discover",  icon: Compass },
  { label: "My Bookings", href: "/bookings",  icon: BookOpen },
  { label: "Payments",    href: "/payments",  icon: CreditCard },
  { label: "Saved",       href: "/saved",     icon: Heart },
];

export function FanSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();
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

    const channel = supabase
      .channel("fan-sidebar-live-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, refreshIfVisible)
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles" }, refreshIfVisible)
      .subscribe();

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      if (liveExpiryTimeoutRef.current) window.clearTimeout(liveExpiryTimeoutRef.current);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <aside className="hidden md:flex flex-col w-[220px] min-h-screen fan-rail shrink-0 animate-rail-enter">

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
                  ? "bg-brand-primary text-white shadow-sm"
                  : "text-brand-ink-muted hover:text-brand-ink hover:bg-brand-elevated"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "opacity-90" : "")} />
              <span className={cn("font-display", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile footer */}
      <div className="px-3 pb-5 pt-4 border-t border-brand-border/60">
        <div className="flex items-center gap-2.5">
          <Avatar
            initials={user?.avatar_initials ?? "?"}
            color={user?.avatar_color ?? "bg-violet-500"}
            size="sm"
            imageUrl={user?.avatar_url && user?.id ? `/api/public/avatar/${user.id}` : undefined}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-ink truncate leading-tight">
              {user?.full_name ?? "Guest"}
            </p>
            <p className="text-[11px] text-brand-ink-subtle truncate">
              {user?.username ? `@${user.username}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href="/settings"
              className="text-brand-ink-subtle hover:text-brand-ink-muted transition-colors p-1.5 rounded-lg hover:bg-brand-elevated"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-brand-ink-subtle hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
