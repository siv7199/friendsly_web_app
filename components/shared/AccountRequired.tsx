"use client";

import { useState } from "react";
import { LockKeyhole, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestAuthModal } from "@/components/shared/GuestAuthModal";

interface AccountRequiredProps {
  title: string;
  description: string;
  next?: string;
}

export function AccountRequired({ title, description, next }: AccountRequiredProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-8 text-center shadow-[0_18px_50px_rgba(55,33,110,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-serif font-normal tracking-tight text-brand-ink">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-brand-ink-muted">{description}</p>
          <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:justify-center">
            <Button variant="primary" className="w-full gap-2 min-[420px]:w-auto" onClick={() => setAuthOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Make an account
            </Button>
            <Button variant="outline" className="w-full min-[420px]:w-auto" onClick={() => setAuthOpen(true)}>
              Sign in instead
            </Button>
          </div>
        </div>
      </div>
      <GuestAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        next={next}
        reason={description}
      />
    </>
  );
}
