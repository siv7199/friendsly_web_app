import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPageLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-brand-bg px-4 py-12 md:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-subtle transition-colors hover:text-brand-ink"
          >
            Back to Friendsly
          </Link>
          <div className="rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-semibold">DRAFT - not yet reviewed by counsel</p>
            <p className="mt-1 text-amber-800">
              This placeholder copy is here so product links and required disclosures exist before launch.
            </p>
          </div>
          <div className="rounded-[32px] border border-brand-border bg-brand-surface px-6 py-8 shadow-card md:px-10 md:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink-subtle">
              Effective {effectiveDate}
            </p>
            <h1 className="mt-3 text-4xl font-serif font-normal text-brand-ink">{title}</h1>
            <div className="mt-8 space-y-8 text-sm leading-7 text-brand-ink-subtle">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
