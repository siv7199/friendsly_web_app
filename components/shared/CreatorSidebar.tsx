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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import { getCreatorLiveConsolePath } from "@/lib/routes";

export function CreatorSidebar() {
  const pathname = usePathname();
  const { user } = useAuthContext();

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

  return (
    <aside className="hidden w-[220px] shrink-0 fan-rail animate-rail-enter md:sticky md:top-0 md:flex md:h-screen md:flex-col md:self-stretch">

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
    </aside>
  );
}
