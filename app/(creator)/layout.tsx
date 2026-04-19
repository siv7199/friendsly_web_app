"use client";

import { usePathname } from "next/navigation";
import { CreatorSidebar } from "@/components/shared/CreatorSidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { GlobalLiveStatusManager } from "@/components/creator/GlobalLiveStatusManager";
import { MobileAccountBar } from "@/components/shared/MobileAccountBar";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersiveLiveRoute = pathname === "/live";

  return (
    <div className="flex min-h-screen bg-brand-bg">
      <GlobalLiveStatusManager />
      {!isImmersiveLiveRoute ? <CreatorSidebar /> : null}
      <main className={isImmersiveLiveRoute ? "flex-1 overflow-hidden" : "flex-1 overflow-x-hidden pb-16 md:pb-0"}>
        {!isImmersiveLiveRoute ? <MobileAccountBar /> : null}
        {children}
      </main>
      {!isImmersiveLiveRoute ? <BottomNav type="creator" /> : null}
    </div>
  );
}
