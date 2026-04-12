"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ShareableBookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Shareable booking page failed to render.", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-12 md:px-6">
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">
          Booking Page Error
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-50">
          This booking page hit an error
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-red-100/90">
          Try loading the page again. If you are running locally in dev mode and just refreshed,
          restarting the Next server usually clears stale chunk issues.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="gold" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
