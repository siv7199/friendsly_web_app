import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: { value: string; positive: boolean };
  icon: React.ReactNode;
  accent?: "primary" | "gold" | "live" | "info";
  className?: string;
}

const accentMap = {
  primary: {
    icon: "bg-brand-primary/20 text-brand-primary-light",
    border: "hover:border-brand-primary/40",
  },
  gold: {
    icon: "bg-brand-gold/20 text-brand-gold",
    border: "hover:border-brand-gold/40",
  },
  live: {
    icon: "bg-brand-live/20 text-brand-live",
    border: "hover:border-brand-live/40",
  },
  info: {
    icon: "bg-brand-info/20 text-brand-info",
    border: "hover:border-brand-info/40",
  },
};

export function StatsCard({
  title,
  value,
  subtext,
  trend,
  icon,
  accent = "primary",
  className,
}: StatsCardProps) {
  const a = accentMap[accent];
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-border bg-brand-surface p-5 transition-all duration-200",
        a.border,
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", a.icon)}>
          {icon}
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
              trend.positive
                ? "text-brand-live bg-brand-live/10"
                : "text-red-400 bg-red-400/10"
            )}
          >
            {trend.positive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.value}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400 mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-100">{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}
