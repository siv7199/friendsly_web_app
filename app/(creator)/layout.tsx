import { CreatorSidebar } from "@/components/shared/CreatorSidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { GlobalLiveStatusManager } from "@/components/creator/GlobalLiveStatusManager";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-bg">
      <GlobalLiveStatusManager />
      <CreatorSidebar />
      <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
        {children}
      </main>
      <BottomNav type="creator" />
    </div>
  );
}
