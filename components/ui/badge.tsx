import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold font-display transition-colors",
  {
    variants: {
      variant: {
        default:  "border-brand-border   bg-brand-panel      text-brand-ink-muted",
        primary:  "border-brand-primary/20 bg-brand-primary-bg text-brand-primary-deep",
        gold:     "border-amber-300/40   bg-amber-50         text-amber-700",
        live:     "border-orange-400/30  bg-orange-50        text-orange-600",
        info:     "border-brand-info/25  bg-brand-info/8     text-brand-info",
        danger:   "border-red-300/40     bg-red-50           text-red-600",
        outline:  "border-brand-border   bg-transparent      text-brand-ink-muted",
        // Dark-context variants for creator components
        "dark-default": "border-brand-dark-border bg-brand-dark-elevated text-slate-400",
        "dark-primary": "border-brand-primary/30 bg-brand-primary/15 text-brand-primary-light",
        "dark-live":    "border-orange-500/30 bg-orange-500/15 text-orange-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
