"use client";

import { usePathname } from "next/navigation";
import { FanSidebar } from "@/components/shared/FanSidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { FanBookingQuickJoinBanner } from "@/components/fan/FanBookingQuickJoinBanner";

export default function FanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersiveLiveRoute = pathname.startsWith("/waiting-room/");

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {!isImmersiveLiveRoute ? <FanSidebar /> : null}
      <main
        className={
          isImmersiveLiveRoute
            ? "flex-1 overflow-hidden bg-brand-dark"
            : "flex-1 overflow-x-hidden pb-16 md:pb-0 bg-brand-bg"
        }
      >
        {!isImmersiveLiveRoute ? <FanBookingQuickJoinBanner /> : null}
        {children}
      </main>
      {!isImmersiveLiveRoute ? <BottomNav type="fan" /> : null}
    </div>
  );
}
