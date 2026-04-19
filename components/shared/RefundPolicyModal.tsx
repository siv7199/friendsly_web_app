"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const POLICY_ITEMS = [
  { label: "Cancel >24h before", outcome: "Full refund" },
  { label: "Cancel <24h before", outcome: "50% refund" },
  { label: "Creator no-show", outcome: "Full refund" },
  { label: "Fan no-show (creator waited)", outcome: "75% refund" },
  { label: "Both absent", outcome: "Full refund" },
  { label: "Auto-cancel after 10 min", outcome: "Refund depends on who joined" },
];

type RefundPolicyModalProps = {
  trigger?: "link" | "icon" | "inline";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
};

export function RefundPolicyModal({
  trigger = "link",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  title = "Refund Policy",
  description = "Cancellations and no-shows are handled as follows.",
}: RefundPolicyModalProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;

  useEffect(() => {
    if (openProp === undefined) return;
    setInternalOpen(openProp);
  }, [openProp]);

  function setOpen(nextOpen: boolean) {
    if (openProp === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  return (
    <>
      {trigger === "link" ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary-light transition-colors hover:text-brand-primary hover:underline underline-offset-2"
        >
          <Info className="w-3 h-3" />
          Refund policy
        </button>
      ) : trigger === "inline" ? (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-start gap-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 text-left transition-colors",
            "hover:border-brand-primary/30 hover:bg-brand-primary/5"
          )}
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary-light">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">Refund policy</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-ink-subtle">
              Review cancellation timing, no-show outcomes, and late-fee rules without leaving this flow.
            </p>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="View refund policy"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-border bg-brand-elevated transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/10"
        >
          <Info className="w-3.5 h-3.5 text-brand-ink-muted" />
        </button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogContent
          className="w-full max-w-md"
          title={title}
          description={description}
        >
          <div className="space-y-3">
            {POLICY_ITEMS.map(({ label, outcome }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3"
              >
                <span className="text-sm text-brand-ink-muted">{label}</span>
                <span className="text-sm font-semibold text-brand-ink shrink-0">{outcome}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-brand-ink-subtle">
            A 10% late fee applies only when the creator is already waiting and you join more than 5 minutes after the scheduled start time. Auto-cancel triggers after 10 minutes if either participant has not joined.
          </p>
          <button
            onClick={() => setOpen(false)}
            className="mt-5 w-full rounded-xl border border-brand-border bg-brand-elevated py-2.5 text-sm font-medium text-brand-ink-muted transition-colors hover:bg-brand-primary/5 hover:text-brand-ink"
          >
            Got it
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
