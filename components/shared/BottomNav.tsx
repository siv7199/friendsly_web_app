"use client";

/**
 * BottomNav — mobile navigation bar
 *
 * Appears on screens smaller than md (768px).
 * The `type` prop toggles between fan and creator nav items.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass, BookOpen, Heart,
  LayoutDashboard, Settings2, CalendarDays, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FAN_ITEMS = [
  { label: "Discover",  href: "/discover",    icon: Compass },
  { label: "Bookings",  href: "/bookings",    icon: BookOpen },
  { label: "Saved",     href: "/saved",       icon: Heart },
];

const CREATOR_ITEMS = [
  { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
  { label: "Manage",    href: "/management", icon: Settings2 },
  { label: "Calendar",  href: "/calendar",   icon: CalendarDays },
  { label: "Go Live",   href: "/live",       icon: Radio, highlight: true },
];

export function BottomNav({ type }: { type: "fan" | "creator" }) {
  const pathname = usePathname();
  const items = type === "fan" ? FAN_ITEMS : CREATOR_ITEMS;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-surface/95 backdrop-blur border-t border-brand-border">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
                isActive
                  ? "text-brand-primary-light"
                  : "text-slate-500 hover:text-slate-300",
                (item as { highlight?: boolean }).highlight && !isActive
                  ? "text-brand-live"
                  : ""
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
