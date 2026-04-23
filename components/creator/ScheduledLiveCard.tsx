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

function getDatePart(value: string) {
  const [datePart] = value.split("T");
  return datePart ?? "";
}

function getTimePart(value: string) {
  const [, timePart] = value.split("T");
  return timePart?.slice(0, 5) ?? "";
}

function combineDateTimeParts(datePart: string, timePart: string) {
  if (!datePart) return "";
  return `${datePart}T${timePart || "12:00"}`;
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
  const scheduledLiveDatePart = getDatePart(scheduledLiveAt);
  const scheduledLiveTimePart = getTimePart(scheduledLiveAt);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary-light">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-light">Schedule Live</p>
          <p className="mt-1 max-w-full break-words pr-1 text-sm font-semibold leading-5 text-brand-ink">
            {formatScheduledLiveLabel(scheduledLiveAtIso, scheduledLiveTimeZone)}
          </p>
          <p className="mt-1 text-xs text-brand-ink-subtle">
            Pick a time so fans know when to show up.
          </p>
        </div>
      </div>

      <div className="mt-4 min-w-0 space-y-3">
        <div className="min-w-0 sm:hidden">
          <div className="grid grid-cols-1 gap-3">
            <input
              type="date"
              value={scheduledLiveDatePart}
              onChange={(event) => onChangeDateTime(combineDateTimeParts(event.target.value, scheduledLiveTimePart))}
              className="mobile-native-field scheduled-live-field block h-12 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-elevated px-3 text-[16px] leading-tight text-brand-ink [color-scheme:light] focus:border-brand-primary focus:outline-none"
            />
            <input
              type="time"
              value={scheduledLiveTimePart}
              onChange={(event) => onChangeDateTime(combineDateTimeParts(scheduledLiveDatePart, event.target.value))}
              disabled={!scheduledLiveDatePart}
              className="mobile-native-field scheduled-live-field block h-12 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-elevated px-3 text-[16px] leading-tight text-brand-ink [color-scheme:light] focus:border-brand-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <div className="hidden min-w-0 sm:block">
          <input
            type="datetime-local"
            value={scheduledLiveAt}
            onChange={(event) => onChangeDateTime(event.target.value)}
            className="mobile-native-field scheduled-live-datetime scheduled-live-field block h-11 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-border bg-brand-elevated px-4 pr-5 text-sm leading-tight text-brand-ink [color-scheme:light] focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="min-w-0">
          <select
            value={scheduledLiveTimeZone}
            onChange={(event) => onChangeTimeZone(event.target.value)}
            className="mobile-native-field scheduled-live-field block h-12 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-elevated pl-3 pr-9 text-[16px] leading-tight text-brand-ink focus:outline-none focus:border-brand-primary sm:h-11 sm:rounded-xl sm:pl-4 sm:pr-10 sm:text-sm"
          >
            {COMMON_TIME_ZONES.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {formatTimeZoneLabel(timeZone)}
              </option>
            ))}
          </select>
        </div>
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
