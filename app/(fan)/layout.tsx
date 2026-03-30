/**
 * Fan Route Group Layout  (app/(fan)/layout.tsx)
 *
 * The "(fan)" parentheses create a "Route Group" in Next.js — the folder
 * name is INVISIBLE in the URL. So this layout applies to:
 *   /discover, /profile/[id], /waiting-room/[id], etc.
 *
 * This layout renders the FanSidebar on desktop and BottomNav on mobile.
 * All fan pages get wrapped in this automatically.
 */

import { FanSidebar } from "@/components/shared/FanSidebar";
import { BottomNav } from "@/components/shared/BottomNav";

export default function FanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Desktop Sidebar */}
      <FanSidebar />

      {/* Main content area */}
      <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav type="fan" />
    </div>
  );
}
