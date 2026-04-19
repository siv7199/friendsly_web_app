import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover active:scale-[0.97] active:brightness-95",
        gold:
          "bg-gradient-gold text-white font-bold hover:brightness-[1.08] active:scale-[0.97]",
        outline:
          "border border-brand-border bg-transparent text-brand-ink-muted hover:border-brand-primary/50 hover:text-brand-primary hover:bg-brand-primary/5 active:scale-[0.97]",
        ghost:
          "bg-transparent text-brand-ink-muted hover:text-brand-ink hover:bg-brand-elevated active:scale-[0.97]",
        danger:
          "bg-red-600 text-white hover:bg-red-700 active:scale-[0.97]",
        live:
          "bg-brand-live text-white font-bold hover:brightness-[1.08] active:scale-[0.97] shadow-sm",
        surface:
          "bg-brand-surface border border-brand-border text-brand-ink-muted hover:border-brand-primary/40 hover:text-brand-ink active:scale-[0.97]",
        // Dark-context variants for creator studio
        "dark-outline":
          "border border-brand-dark-border bg-transparent text-slate-300 hover:border-brand-primary/60 hover:text-brand-primary-light hover:bg-brand-primary/5 active:scale-[0.97]",
        "dark-ghost":
          "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-brand-dark-elevated active:scale-[0.97]",
      },
      size: {
        sm:   "h-8 px-3.5 text-xs rounded-xl",
        md:   "h-10 px-5 text-sm rounded-xl",
        lg:   "h-11 px-6 text-sm rounded-xl",
        xl:   "h-12 px-8 text-base rounded-2xl",
        icon: "h-9 w-9 p-0 rounded-xl",
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
