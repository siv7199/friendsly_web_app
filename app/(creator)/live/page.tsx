/**
 * Go Live Page  (route: /live)
 *
 * The creator's live session console.
 * Houses the split-screen video placeholder and queue management sidebar.
 */

import { LiveConsole } from "@/components/creator/LiveConsole";

export default function LivePage() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto h-[calc(100vh-3rem)] flex flex-col gap-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-slate-100">Live Studio</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Go public, chat with viewers, and admit one paid guest at a time for 30-second turns.
        </p>
      </div>

      {/* ── Console fills remaining height ── */}
      <div className="flex-1 min-h-0">
        <LiveConsole />
      </div>
    </div>
  );
}
