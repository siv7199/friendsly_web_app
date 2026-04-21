"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  DollarSign,
  Settings2,
  CalendarDays,
  Radio,
  Settings,
  LogOut,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import { getCreatorLiveConsolePath } from "@/lib/routes";

export function CreatorSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();

  const isLive = user && isCreatorProfile(user) ? user.is_live : false;

  const liveHref = user
    ? getCreatorLiveConsolePath({ id: user.id, username: user.username })
    : "/live";

  const NAV_ITEMS = [
    { label: "Dashboard",        href: "/dashboard",  icon: LayoutDashboard, highlight: false },
    { label: "Analytics",        href: "/analytics",  icon: BarChart3,       highlight: false },
    { label: "Earnings",         href: "/earnings",   icon: DollarSign,      highlight: false },
    { label: "Bookings / Offerings", href: "/management", icon: Settings2,       highlight: false },
    { label: "Calendar",         href: "/calendar",   icon: CalendarDays,    highlight: false },
    { label: "Go Live",          href: liveHref,      icon: Radio,           highlight: true  },
  ];

  async function handleLogout() {
    await logout();
    window.location.replace("/");
  }

  return (
    <aside className="hidden md:flex flex-col w-[220px] min-h-screen fan-rail shrink-0 animate-rail-enter">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-border/60">
        <BrandLogo subtitle="Creator Studio" theme="light" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isGoLive = item.highlight;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-gradient-primary text-white shadow-nav-active"
                  : isGoLive
                    ? "text-brand-live hover:bg-brand-live/10"
                    : "text-brand-ink-muted hover:text-brand-ink hover:bg-brand-elevated"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isGoLive && !isActive ? "text-brand-live" : "")} />
              <span className="flex-1 font-display">{item.label}</span>
              {isGoLive && !isActive && isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              )}
              {isGoLive && !isActive && !isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-live/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile footer */}
      <div className="px-3 pb-5 pt-4 border-t border-brand-border/60">
        <div className="flex items-center gap-2.5">
          <Avatar
            initials={user?.avatar_initials ?? "?"}
            color={user?.avatar_color ?? "bg-violet-600"}
            size="sm"
            isLive={isLive}
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
              href="/support"
              className="text-brand-ink-subtle hover:text-brand-ink-muted transition-colors p-1.5 rounded-lg hover:bg-brand-elevated"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
            </Link>
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
