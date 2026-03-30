/**
 * components/ui/button.tsx
 *
 * A reusable Button component using class-variance-authority (cva).
 * cva lets you define VARIANTS — different visual styles for the same component —
 * without writing messy if/else logic everywhere.
 *
 * Usage:
 *   <Button variant="primary" size="lg">Book Now</Button>
 *   <Button variant="ghost" size="sm">Cancel</Button>
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Define all the visual variants with cva
const buttonVariants = cva(
  // Base classes applied to ALL variants
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-white shadow-glow-primary hover:shadow-glow-primary hover:brightness-110 active:scale-[0.98]",
        gold:
          "bg-gradient-gold text-brand-bg shadow-glow-gold hover:brightness-110 active:scale-[0.98]",
        outline:
          "border border-brand-border bg-transparent text-slate-300 hover:border-brand-primary hover:text-brand-primary-light hover:bg-brand-primary/5",
        ghost:
          "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-brand-surface",
        danger:
          "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]",
        live:
          "bg-brand-live text-brand-bg font-bold shadow-glow-live hover:brightness-110 active:scale-[0.98]",
        surface:
          "bg-brand-surface border border-brand-border text-slate-300 hover:border-brand-primary/40 hover:text-white",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-9 text-lg",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
