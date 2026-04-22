"use client";

import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMMON_TIME_ZONES,
  formatTimeZoneLabel,
  getTimeZoneAbbreviation,
} from "@/lib/timezones";

function formatScheduledLiveLabel(value: string | null, timeZone: string) {
  if (!value) return "No live scheduled";

  const scheduledDate = new Date(value);
  if (Number.isNaN(scheduledDate.getTime())) return "No live scheduled";

  return `${scheduledDate.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} ${getTimeZoneAbbreviation(scheduledDate, timeZone)}`;
}

interface ScheduledLiveCardProps {
  scheduledLiveAt: string;
  scheduledLiveTimeZone: string;
  scheduledLiveAtIso?: string | null;
  liveRateConfigured: boolean;
  saving: boolean;
  onChangeDateTime: (value: string) => void;
  onChangeTimeZone: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  openStudioHref: string;
}

export function ScheduledLiveCard({
  scheduledLiveAt,
  scheduledLiveTimeZone,
  scheduledLiveAtIso = null,
  liveRateConfigured,
  saving,
  onChangeDateTime,
  onChangeTimeZone,
  onSave,
  onClear,
  openStudioHref,
}: ScheduledLiveCardProps) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary-light">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-light">Scheduled Live</p>
          <p className="mt-1 max-w-full break-words pr-1 text-sm font-semibold leading-5 text-brand-ink">
            {formatScheduledLiveLabel(scheduledLiveAtIso, scheduledLiveTimeZone)}
          </p>
          <p className="mt-1 text-xs text-brand-ink-subtle">
            Pick a time so fans know when to show up.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 min-w-0">
        <input
          type="datetime-local"
          value={scheduledLiveAt}
          onChange={(event) => onChangeDateTime(event.target.value)}
          className="block h-11 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink [color-scheme:light] focus:outline-none focus:border-brand-primary"
        />
        <select
          value={scheduledLiveTimeZone}
          onChange={(event) => onChangeTimeZone(event.target.value)}
          className="block h-11 w-full min-w-0 max-w-full rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink focus:outline-none focus:border-brand-primary"
        >
          {COMMON_TIME_ZONES.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {formatTimeZoneLabel(timeZone)}
            </option>
          ))}
        </select>
      </div>

      {!liveRateConfigured ? (
        <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-5 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          Set an amount per minute in Management before going live.
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="outline" className="w-full" onClick={onClear}>
          Clear
        </Button>
        <Button variant="primary" className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Link
        href={openStudioHref}
        className="mt-4 inline-flex max-w-full items-center gap-1 break-words text-sm font-medium text-brand-primary-light hover:underline"
      >
        <Radio className="h-4 w-4" />
        Open live studio
      </Link>
    </div>
  );
}
