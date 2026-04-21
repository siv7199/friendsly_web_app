"use client";

import { LiveConsole } from "@/components/creator/LiveConsole";

export default function MobileCreatorLivePage() {
  return (
    <div className="px-4 py-4 min-h-[100dvh] overflow-x-hidden flex flex-col">
      <div className="mx-auto w-full max-w-[1600px] flex-1 flex min-h-0">
        <LiveConsole />
      </div>
    </div>
  );
}
