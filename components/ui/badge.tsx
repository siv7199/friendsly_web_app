import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:  "border-brand-border bg-brand-surface text-slate-300",
        primary:  "border-brand-primary/30 bg-brand-primary/10 text-brand-primary-light",
        gold:     "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
        live:     "border-brand-live/30 bg-brand-live/10 text-brand-live",
        info:     "border-brand-info/30 bg-brand-info/10 text-brand-info",
        danger:   "border-red-500/30 bg-red-500/10 text-red-400",
        outline:  "border-brand-border bg-transparent text-slate-400",
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
