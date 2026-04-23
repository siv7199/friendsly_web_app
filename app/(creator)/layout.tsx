"use client";

import { usePathname } from "next/navigation";
import { CreatorSidebar } from "@/components/shared/CreatorSidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { GlobalLiveStatusManager } from "@/components/creator/GlobalLiveStatusManager";
import { MobileAccountBar } from "@/components/shared/MobileAccountBar";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersiveLiveRoute = pathname === "/live" || pathname.startsWith("/live/");

  return (
    <div className="flex h-full min-h-0 items-stretch overflow-hidden bg-brand-bg">
      <GlobalLiveStatusManager />
      {!isImmersiveLiveRoute ? <CreatorSidebar /> : null}
      <main
        className={
          isImmersiveLiveRoute
            ? "flex-1 overflow-hidden"
            : "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-brand-bg pb-36 pt-24 md:pb-24 md:pt-0"
        }
      >
        {!isImmersiveLiveRoute ? <MobileAccountBar /> : null}
        {children}
      </main>
      {!isImmersiveLiveRoute ? <BottomNav type="creator" /> : null}
    </div>
  );
}
