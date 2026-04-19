import { Loader2 } from "lucide-react";

export default function ShareableBookingLoading() {
  return (
    <main className="min-h-screen bg-brand-bg px-4 py-12 md:px-6">
      <div className="mx-auto flex max-w-2xl items-center justify-center rounded-3xl border border-brand-border bg-brand-surface px-6 py-16 text-brand-ink-subtle">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-brand-primary" />
        Loading booking page...
      </div>
    </main>
  );
}
