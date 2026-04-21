"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass, BookOpen, Heart, CreditCard,
  LayoutDashboard, Settings2, CalendarDays, Radio, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getCreatorLiveConsolePath } from "@/lib/routes";

const FAN_ITEMS = [
  { label: "Discover",  href: "/discover",  icon: Compass },
  { label: "Bookings",  href: "/bookings",  icon: BookOpen },
  { label: "Payments",  href: "/payments",  icon: CreditCard },
  { label: "Saved",     href: "/saved",     icon: Heart },
];

export function BottomNav({ type }: { type: "fan" | "creator" }) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const isFan = type === "fan";

  const liveHref = user
    ? getCreatorLiveConsolePath({ id: user.id, username: user.username })
    : "/live";

  const CREATOR_ITEMS = [
    { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
    { label: "Earnings",  href: "/earnings",   icon: DollarSign },
    { label: "Offerings", href: "/management", icon: Settings2 },
    { label: "Calendar",  href: "/calendar",   icon: CalendarDays },
    { label: "Go Live",   href: liveHref,      icon: Radio, highlight: true },
  ];

  const items = type === "fan" ? FAN_ITEMS : CREATOR_ITEMS;

  return (
    <nav className={cn(
      "md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md",
      "bg-white/95 border-t border-brand-border/70"
    )}>
      <div className="flex items-center justify-around h-[60px] px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isHighlight = (item as { highlight?: boolean }).highlight;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 min-w-[52px]",
                isActive
                  ? "text-brand-primary"
                  : isHighlight && !isActive
                    ? "text-brand-live"
                    : "text-brand-ink-subtle hover:text-brand-ink"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9.5px] font-semibold font-display tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
