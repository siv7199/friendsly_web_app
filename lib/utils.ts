import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Class Name utility
 *
 * Used everywhere to combine Tailwind classes safely.
 * - clsx handles conditional classes: cn("base", isActive && "active")
 * - twMerge resolves conflicting Tailwind classes: "p-4 p-6" → "p-6"
 *
 * This is the standard pattern used by shadcn/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as USD currency
 * formatCurrency(25) → "$25.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string to a readable label
 * formatDate("2025-08-01") → "Aug 1, 2025"
 */
export function formatDate(dateStr: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T12:00:00`)
    : new Date(dateStr);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Returns a relative time string
 * timeAgo("2025-07-31T10:00:00") → "2 hours ago"
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Returns a color class based on a booking status
 */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    upcoming:  "text-brand-info bg-brand-info/10 border-brand-info/20",
    completed: "text-brand-live bg-brand-live/10 border-brand-live/20",
    cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
    live:      "text-brand-gold bg-brand-gold/10 border-brand-gold/20",
  };
  return map[status] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20";
}
