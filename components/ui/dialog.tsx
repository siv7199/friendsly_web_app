"use client";

/**
 * Dialog — a modal overlay component.
 *
 * We build this from scratch using React state rather than Radix UI
 * so you can see exactly how modals work.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Dialog open={open} onClose={() => setOpen(false)}>
 *     <DialogContent title="Book a Call">...</DialogContent>
 *   </Dialog>
 */

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal content — positioned above backdrop */}
      <div className="relative z-10 animate-slide-up">{children}</div>
    </div>
  );
}

export function DialogContent({
  title,
  description,
  children,
  className,
}: DialogContentProps) {
  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-2xl border border-brand-border bg-brand-elevated shadow-card",
        "max-h-[90vh] overflow-y-auto",
        className
      )}
    >
      {(title || description) && (
        <div className="px-6 pt-6 pb-4 border-b border-brand-border">
          {title && (
            <h2 className="text-xl font-bold text-brand-ink">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-brand-ink-muted mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClose}
      className={cn(
        "absolute top-4 right-4 rounded-lg p-1.5 text-brand-ink-subtle hover:text-brand-ink hover:bg-brand-elevated transition-colors",
        className
      )}
    >
      <X className="w-4 h-4" />
    </button>
  );
}
