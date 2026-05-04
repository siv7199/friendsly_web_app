"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Compass, BookOpen, Heart, CreditCard,
  LayoutDashboard, Settings2, Radio, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getCreatorLiveConsolePath } from "@/lib/routes";
import { GuestAuthModal } from "@/components/shared/GuestAuthModal";

const FAN_ITEMS = [
  { label: "Discover",  href: "/discover",  icon: Compass },
  { label: "Bookings",  href: "/bookings",  icon: BookOpen },
  { label: "Payments",  href: "/payments",  icon: CreditCard },
  { label: "Saved",     href: "/saved",     icon: Heart },
];

const FAN_ACCOUNT_ITEMS = new Set(["/bookings", "/payments", "/saved"]);

export function BottomNav({
  type,
  floating = true,
}: {
  type: "fan" | "creator";
  floating?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const [authNext, setAuthNext] = useState<string | null>(null);
  const isFan = type === "fan";

  const liveHref = user
    ? getCreatorLiveConsolePath({ id: user.id, username: user.username })
    : "/live";

  const CREATOR_ITEMS = [
    { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
    { label: "Go Live",   href: liveHref,      icon: Radio, highlight: true },
    { label: "Earnings",  href: "/earnings",   icon: DollarSign },
    { label: "Offerings", href: "/management", icon: Settings2 },
  ];

  const items = type === "fan" ? FAN_ITEMS : CREATOR_ITEMS;

  if (!floating) {
    return (
      <nav className="md:hidden rounded-2xl border border-brand-border/70 bg-white/95 p-2 shadow-[0_16px_36px_rgba(26,22,40,0.08)] backdrop-blur-md">
        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const isHighlight = (item as { highlight?: boolean }).highlight;
            const requiresAccount = isFan && !user && FAN_ACCOUNT_ITEMS.has(item.href);
            const className = cn(
              "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center transition-all duration-150",
              isActive
                ? "bg-brand-primary/10 text-brand-primary"
                : isHighlight
                  ? "text-brand-live"
                  : "text-brand-ink-subtle hover:bg-brand-elevated hover:text-brand-ink"
            );
            const content = (
              <>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold font-display tracking-wide">{item.label}</span>
              </>
            );

            if (requiresAccount) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => setAuthNext(item.href)}
                  className={className}
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
        </div>
        <GuestAuthModal
          open={Boolean(authNext)}
          onClose={() => setAuthNext(null)}
          next={authNext ?? undefined}
          reason="Make an account to use this area."
        />
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md",
        "bg-white/95 border-t border-brand-border/70"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-[60px] px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isHighlight = (item as { highlight?: boolean }).highlight;
          const requiresAccount = isFan && !user && FAN_ACCOUNT_ITEMS.has(item.href);
          const className = cn(
            "flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl transition-all duration-150 min-w-0 flex-1",
            isActive
              ? "text-brand-primary"
              : isHighlight && !isActive
                ? "text-brand-live"
                : "text-brand-ink-subtle hover:text-brand-ink"
          );
          const content = (
            <>
              <Icon className="w-5 h-5" />
              <span className="text-[9.5px] font-semibold font-display tracking-wide">{item.label}</span>
            </>
          );

          if (requiresAccount) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setAuthNext(item.href)}
                className={className}
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
      </div>
      <GuestAuthModal
        open={Boolean(authNext)}
        onClose={() => setAuthNext(null)}
        next={authNext ?? undefined}
        reason="Make an account to use this area."
      />
    </nav>
  );
}
