"use client";

import * as React from "react";
import Image from "next/image";
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
  xs: { outer: "w-7 h-7",   text: "text-[10px]", px: 28 },
  sm: { outer: "w-9 h-9",   text: "text-xs",     px: 36 },
  md: { outer: "w-12 h-12", text: "text-sm",     px: 48 },
  lg: { outer: "w-16 h-16", text: "text-lg",     px: 64 },
  xl: { outer: "w-24 h-24", text: "text-2xl",    px: 96 },
};

export function Avatar({
  initials,
  color = "bg-violet-600",
  size = "md",
  isLive = false,
  className,
  imageUrl,
}: AvatarProps) {
  const { outer, text, px } = sizeMap[size];
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = imageUrl && imageUrl.length > 0 && !imgFailed;

  React.useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);

  return (
    <div className={cn("relative shrink-0 rounded-full", className)}>
      <div
        className={cn(
          outer,
          color,
          "relative rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
        )}
      >
        {/* Initials always render as base layer */}
        <span className={cn(text, "select-none")}>{initials}</span>
        {showImage && (
          <Image
            src={imageUrl!}
            alt=""
            width={px}
            height={px}
            sizes={`${px}px`}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
            unoptimized={isUnoptimizable(imageUrl!)}
          />
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

// Hostnames not whitelisted in next.config.mjs would cause next/image to throw;
// fall through to an unoptimized passthrough so the <img> still renders.
function isUnoptimizable(url: string) {
  if (url.startsWith("/")) return false;
  try {
    const host = new URL(url).hostname;
    return !(
      host.endsWith("supabase.co") ||
      host === "lh3.googleusercontent.com" ||
      host === "api.dicebear.com" ||
      host === "images.unsplash.com"
    );
  } catch {
    return true;
  }
}
