"use client";

/**
 * CreatorSidebar
 *
 * The left-side navigation bar shown to creators.
 * On mobile it collapses to a bottom navigation bar (see BottomNav.tsx).
 *
 * Uses Next.js `usePathname()` to highlight the active route.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  DollarSign,
  Settings2,
  CalendarDays,
  Radio,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    badge: null,
  },
  {
    label: "Earnings",
    href: "/earnings",
    icon: DollarSign,
    badge: null,
  },
  {
    label: "Manage Offerings",
    href: "/management",
    icon: Settings2,
    badge: null,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    badge: null,
  },
  {
    label: "Go Live",
    href: "/live",
    icon: Radio,
    badge: null,
    highlight: true,
  },
];

export function CreatorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const isLive = user && isCreatorProfile(user) ? user.is_live : false;

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-brand-surface border-r border-brand-border shrink-0">
      <div className="px-6 py-5 border-b border-brand-border">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-black text-white group-hover:text-brand-primary-light transition-colors">
            Friendsly
          </span>
        </Link>
        <div className="mt-1 ml-10">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            Creator Studio
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-brand-primary/20 text-brand-primary-light border border-brand-primary/20"
                  : item.highlight
                    ? "text-brand-live hover:bg-brand-live/10 border border-transparent hover:border-brand-live/20"
                    : "text-slate-400 hover:text-slate-100 hover:bg-brand-elevated border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-brand-primary-light" : "",
                  item.highlight ? "text-brand-live" : ""
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                  {item.badge}
                </Badge>
              )}
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-brand-border pt-4">
        <div className="flex items-center gap-3">
          <Avatar
            initials={user?.avatar_initials ?? "?"}
            color={user?.avatar_color ?? "bg-violet-600"}
            size="sm"
            isLive={isLive}
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
