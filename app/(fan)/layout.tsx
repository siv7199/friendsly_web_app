"use client";

import { usePathname } from "next/navigation";
import { FanSidebar } from "@/components/shared/FanSidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { FanBookingQuickJoinBanner } from "@/components/fan/FanBookingQuickJoinBanner";
import { MobileAccountBar } from "@/components/shared/MobileAccountBar";

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
            : "flex-1 overflow-x-hidden bg-brand-bg pb-36 pt-24 md:pb-24 md:pt-0"
        }
      >
        {!isImmersiveLiveRoute ? <MobileAccountBar /> : null}
        {!isImmersiveLiveRoute ? <FanBookingQuickJoinBanner /> : null}
        {children}
      </main>
      {!isImmersiveLiveRoute ? <BottomNav type="fan" /> : null}
    </div>
  );
}
