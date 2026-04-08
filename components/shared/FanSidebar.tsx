"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  BookOpen,
  Heart,
  Sparkles,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { label: "Discover",    href: "/discover",   icon: Compass },
  { label: "My Bookings", href: "/bookings",   icon: BookOpen },
  { label: "Saved",       href: "/saved",      icon: Heart },
];

export function FanSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [liveCount, setLiveCount] = useState(0);

  // Fetch live creator count from Supabase
  useEffect(() => {
    const supabase = createClient();
    
    async function getCount() {
      const heartbeatCutoffIso = new Date(Date.now() - 45000).toISOString();
      const { data } = await supabase
        .from("live_sessions")
        .select("id, creator_id")
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .gte("last_heartbeat_at", heartbeatCutoffIso);

      const uniqueLiveCreators = new Set((data ?? []).map((session: any) => session.creator_id));

      setLiveCount(uniqueLiveCreators.size);
    }

    getCount();
    const interval = setInterval(getCount, 30000); 
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-brand-surface border-r border-brand-border shrink-0">
      {/* ── Logo ── */}
      <div className="px-6 py-5 border-b border-brand-border">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-black text-white group-hover:text-brand-primary-light transition-colors">
            Friendsly
          </span>
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                isActive
                  ? "bg-brand-primary/20 text-brand-primary-light border-brand-primary/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-brand-elevated"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Featured Live Banner — only shown when creators are live AND fan is not already on Discover ── */}
      {liveCount > 0 && pathname !== "/discover" && (
        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-brand-live/10 to-brand-primary/10 border border-brand-live/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
            <span className="text-xs font-bold text-brand-live uppercase tracking-wider">
              {liveCount} Live Now
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Creator{liveCount !== 1 ? "s are" : " is"} live right now.{" "}
            <Link href="/discover" className="text-brand-primary-light underline underline-offset-2">
              Join the queue →
            </Link>
          </p>
        </div>
      )}

      {/* ── Fan Profile ── */}
      <div className="px-3 pb-4 border-t border-brand-border pt-4">
        <div className="flex items-center gap-3">
          <Avatar
            initials={user?.avatar_initials ?? "?"}
            color={user?.avatar_color ?? "bg-violet-500"}
            size="sm"
            imageUrl={user?.avatar_url ?? undefined}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {user?.full_name ?? "Guest"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.username ? `@${user.username}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings" className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-brand-elevated">
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
