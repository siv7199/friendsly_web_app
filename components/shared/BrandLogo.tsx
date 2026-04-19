"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  href?: string;
  className?: string;
  subtitle?: string;
  size?: "sm" | "md";
  theme?: "dark" | "light";
}

export function BrandLogo({
  href = "/",
  className,
  subtitle,
  size = "md",
  theme = "dark",
}: BrandLogoProps) {
  const wordmarkSize = size === "sm" ? "text-[1.35rem]" : "text-[1.6rem]";

  const content = (
    <div className={cn("flex flex-col gap-0", className)}>
      <span
        className={cn(
          "font-brand leading-none tracking-tight",
          wordmarkSize,
          theme === "light" ? "text-brand-primary" : "text-white"
        )}
      >
        friendsly
      </span>
      {subtitle && (
        <span
          className={cn(
            "text-[9px] uppercase tracking-[0.28em] font-display font-semibold mt-0.5",
            theme === "light" ? "text-brand-ink-subtle" : "text-white/50"
          )}
        >
          {subtitle}
        </span>
      )}
    </div>
  );

  return (
    <Link href={href} className="inline-flex items-center outline-none">
      {content}
    </Link>
  );
}
