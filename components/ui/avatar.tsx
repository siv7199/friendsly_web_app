import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isLive?: boolean;
  className?: string;
  imageUrl?: string;
}

const sizeMap = {
  xs: { outer: "w-7 h-7",   text: "text-[10px]" },
  sm: { outer: "w-9 h-9",   text: "text-xs" },
  md: { outer: "w-12 h-12", text: "text-sm" },
  lg: { outer: "w-16 h-16", text: "text-lg" },
  xl: { outer: "w-24 h-24", text: "text-2xl" },
};

export function Avatar({
  initials,
  color = "bg-violet-600",
  size = "md",
  isLive = false,
  className,
  imageUrl,
}: AvatarProps) {
  const { outer, text } = sizeMap[size];
  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          outer,
          imageUrl ? "" : color,
          "rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={initials} className="w-full h-full object-cover" />
        ) : (
          <span className={text}>{initials}</span>
        )}
      </div>
      {isLive && (
        <>
          <div className="absolute inset-[-3px] rounded-full border-2 border-brand-live animate-pulse-live" />
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-brand-live border-2 border-brand-bg" />
        </>
      )}
    </div>
  );
}
