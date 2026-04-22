"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { COMMON_TIME_ZONES, formatTimeZoneLabel, getBrowserTimeZone } from "@/lib/timezones";
import type { CallPackage } from "@/types";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  package_id: string | null;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BOOKING_INTERVAL_OPTIONS = [15, 30, 60];

function defaultSlot(dayOfWeek: number): AvailabilitySlot {
  return {
    id: crypto.randomUUID(),
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "17:00",
    is_active: true,
    package_id: null,
  };
}

function formatTimeLabel(value: string) {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function nextAvailableLabel(slots: AvailabilitySlot[]) {
  const activeSlots = slots.filter((slot) => slot.is_active);
  if (activeSlots.length === 0) return "No availability set";

  const sorted = [...activeSlots].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.start_time.localeCompare(b.start_time);
  });

  const first = sorted[0];
  return `${DAY_LABELS[first.day_of_week]} ${formatTimeLabel(first.start_time)}`;
}

export function WeeklyAvailabilityEditor({
  creatorId,
  packages,
}: {
  creatorId: string;
  packages: CallPackage[];
}) {
  const supabase = createClient();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [creatorTimeZone, setCreatorTimeZone] = useState(getBrowserTimeZone());
  const [bookingIntervalMinutes, setBookingIntervalMinutes] = useState(30);

  useEffect(() => {
    async function loadAvailability() {
      let availability: any[] | null = null;

      const cpRes = await supabase
        .from("creator_profiles")
        .select("timezone, booking_interval_minutes")
        .eq("id", creatorId)
        .single();

      if (cpRes.data?.timezone) {
        setCreatorTimeZone(cpRes.data.timezone);
      }
      if (cpRes.data?.booking_interval_minutes) {
        setBookingIntervalMinutes(cpRes.data.booking_interval_minutes);
      }

      const availabilityRes = await supabase
        .from("creator_availability")
        .select("id, day_of_week, start_time, end_time, is_active, package_id")
        .eq("creator_id", creatorId)
        .order("day_of_week")
        .order("start_time");

      if (availabilityRes.error) {
        const fallbackAvailabilityRes = await supabase
          .from("creator_availability")
          .select("id, day_of_week, start_time, end_time, is_active")
          .eq("creator_id", creatorId)
          .order("day_of_week")
          .order("start_time");
        availability = fallbackAvailabilityRes.data?.map((slot: any) => ({ ...slot, package_id: null })) ?? null;
      } else {
        availability = availabilityRes.data;
      }

      if (availability) {
        setAvailabilitySlots(
          availability.map((slot: any) => ({
            id: slot.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time.slice(0, 5),
            end_time: slot.end_time.slice(0, 5),
            is_active: slot.is_active,
            package_id: slot.package_id,
          }))
        );
      }
    }

    void loadAvailability();
  }, [creatorId, supabase]);

  function addAvailabilitySlot(dayOfWeek: number) {
    setAvailabilitySlots((prev) => [...prev, defaultSlot(dayOfWeek)]);
  }

  function updateAvailabilitySlot(
    id: string,
    field: "start_time" | "end_time" | "package_id",
    value: string
  ) {
    setAvailabilitySlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: field === "package_id" ? value || null : value } : slot))
    );
  }

  function removeAvailabilitySlot(id: string) {
    setAvailabilitySlots((prev) => prev.filter((slot) => slot.id !== id));
  }

  async function saveAvailability() {
    setAvailabilitySaving(true);

    await supabase
      .from("creator_availability")
      .delete()
      .eq("creator_id", creatorId);

    const validSlots = availabilitySlots.filter(
      (slot) => slot.is_active && slot.start_time && slot.end_time && slot.end_time > slot.start_time
    );

    if (validSlots.length > 0) {
      const insertPayload = validSlots.map((slot) => ({
        creator_id: creatorId,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_active: true,
        package_id: slot.package_id,
      }));

      const insertRes = await supabase.from("creator_availability").insert(insertPayload);

      if (insertRes.error) {
        await supabase.from("creator_availability").insert(
          validSlots.map((slot) => ({
            creator_id: creatorId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: true,
          }))
        );
      }
    }

    const profileUpdateRes = await supabase
      .from("creator_profiles")
      .upsert({
        id: creatorId,
        next_available: nextAvailableLabel(validSlots),
        timezone: creatorTimeZone,
        booking_interval_minutes: bookingIntervalMinutes,
      }, { onConflict: "id" });

    if (profileUpdateRes.error) {
      const fallbackProfileRes = await supabase
        .from("creator_profiles")
        .upsert({ id: creatorId, next_available: nextAvailableLabel(validSlots), booking_interval_minutes: bookingIntervalMinutes }, { onConflict: "id" });
      if (fallbackProfileRes.error) {
        await supabase
          .from("creator_profiles")
          .upsert({ id: creatorId, next_available: nextAvailableLabel(validSlots) }, { onConflict: "id" });
      }
    }

    setAvailabilitySaving(false);
    setAvailabilitySaved(true);
    window.setTimeout(() => setAvailabilitySaved(false), 2000);
  }

  const hasInvalidAvailability = availabilitySlots.some(
    (slot) => !slot.start_time || !slot.end_time || slot.end_time <= slot.start_time
  );

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-brand-ink">Weekly Availability</h2>
          <p className="text-sm text-brand-ink-subtle mt-1">
            Set the recurring times fans can book you for 1-on-1 calls each week.
          </p>
        </div>
        <Button
          variant={availabilitySaved ? "surface" : "primary"}
          onClick={saveAvailability}
          disabled={availabilitySaving || hasInvalidAvailability}
        >
          {availabilitySaving ? "Saving..." : availabilitySaved ? "Saved" : "Save Availability"}
        </Button>
      </div>

      <div className="mb-5">
        <label className="text-sm font-medium text-brand-ink-muted mb-2 block">
          Your Time Zone
        </label>
        <select
          value={creatorTimeZone}
          onChange={(e) => setCreatorTimeZone(e.target.value)}
          className="w-full max-w-sm h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink focus:outline-none focus:border-brand-primary"
        >
          {COMMON_TIME_ZONES.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {formatTimeZoneLabel(timeZone)}
            </option>
          ))}
        </select>
        <p className="text-xs text-brand-ink-subtle mt-2">
          Fans will see these slots converted into their own local time automatically.
        </p>
      </div>

      <div className="mb-5">
        <label className="text-sm font-medium text-brand-ink-muted mb-2 block">
          Booking Start Increments
        </label>
        <div className="flex gap-2 flex-wrap">
          {BOOKING_INTERVAL_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setBookingIntervalMinutes(minutes)}
              className={cn(
                "px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                bookingIntervalMinutes === minutes
                  ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light"
                  : "bg-brand-elevated border-brand-border text-brand-ink-subtle hover:border-brand-primary/40 hover:text-brand-ink"
              )}
            >
              Every {minutes} min
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-ink-subtle mt-2">
          Fans will only see booking start times spaced by this interval inside your available windows.
        </p>
      </div>

      <div className="space-y-3">
        {DAY_LABELS.map((dayLabel, dayIndex) => {
          const daySlots = availabilitySlots
            .filter((slot) => slot.day_of_week === dayIndex)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          return (
            <div
              key={dayLabel}
              className="rounded-2xl border border-brand-border bg-brand-elevated/40 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">{dayLabel}</h3>
                  <p className="text-xs text-brand-ink-subtle mt-0.5">
                    {daySlots.length === 0
                      ? "Unavailable"
                      : `${daySlots.length} ${daySlots.length === 1 ? "time slot" : "time slots"}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => addAvailabilitySlot(dayIndex)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Time
                </Button>
              </div>

              {daySlots.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-brand-border px-4 py-3 text-sm text-brand-ink-subtle">
                  No slots yet for {dayLabel}.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {daySlots.map((slot) => {
                    const isInvalid = !slot.start_time || !slot.end_time || slot.end_time <= slot.start_time;

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "rounded-xl border px-3 py-3",
                          isInvalid
                            ? "border-red-500/40 bg-red-500/5"
                            : "border-brand-border bg-brand-surface"
                        )}
                      >
                        <div className="grid grid-cols-1 gap-3 items-end lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                          <div>
                            <label className="text-xs font-medium text-brand-ink-subtle mb-1.5 block">
                              Start
                            </label>
                            <input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => updateAvailabilitySlot(slot.id, "start_time", e.target.value)}
                              step={bookingIntervalMinutes * 60}
                              className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-brand-ink-subtle mb-1.5 block">
                              End
                            </label>
                            <input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => updateAvailabilitySlot(slot.id, "end_time", e.target.value)}
                              step={bookingIntervalMinutes * 60}
                              className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-brand-ink-subtle mb-1.5 block">
                              Offering
                            </label>
                            <select
                              value={slot.package_id ?? ""}
                              onChange={(e) => updateAvailabilitySlot(slot.id, "package_id", e.target.value)}
                              className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-brand-ink focus:outline-none focus:border-brand-primary"
                            >
                              <option value="">All offerings</option>
                              {packages
                                .filter((pkg) => pkg.isActive)
                                .map((pkg) => (
                                  <option key={pkg.id} value={pkg.id}>
                                    {pkg.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-self-start text-brand-ink-subtle hover:text-red-400 lg:justify-self-auto"
                            onClick={() => removeAvailabilitySlot(slot.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {isInvalid && (
                          <p className="mt-2 text-xs text-red-600">
                            End time must be later than start time.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-brand-ink-subtle mt-4">
        Fans will see these recurring weekly windows on your profile when booking calls.
      </p>
    </div>
  );
}
