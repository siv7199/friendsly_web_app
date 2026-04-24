"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Edit2, Trash2, DollarSign,
  Clock, CheckCircle2, ToggleLeft, ToggleRight, Zap, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CallPackage } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { ScheduledLiveCard } from "@/components/creator/ScheduledLiveCard";
import { formatDateTimeLocalInTimeZone, getBrowserTimeZone, localDateKey, zonedTimeToUtc } from "@/lib/timezones";
import {
  MAX_ACTIVE_PACKAGES,
  MIN_BOOKING_PRICE,
  MIN_LIVE_RATE_PER_MINUTE,
} from "@/lib/pricing-limits";

const BOOKING_DURATION_OPTIONS = [15, 30, 45, 60] as const;
const DESCRIPTION_WORD_LIMIT = 100;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface PackageAvailabilityDraft {
  slotId: string | null;
  date: string;
  startTime: string;
  endTime: string;
}

interface PackageAvailabilitySummary {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function limitWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function defaultAvailabilityDraft(): PackageAvailabilityDraft {
  return {
    slotId: null,
    date: localDateKey(new Date()),
    startTime: "09:00",
    endTime: "17:00",
  };
}

function getDayIndexFromDate(dateValue: string) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
}

function getNextDateForDay(dayOfWeek: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const offset = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
}

function formatTimeLabel(value: string) {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatAvailabilitySummary(draft: PackageAvailabilityDraft) {
  const dayIndex = getDayIndexFromDate(draft.date);
  const dayLabel = dayIndex === null ? "Selected day" : DAY_LABELS[dayIndex];
  return `${dayLabel}s, ${formatTimeLabel(draft.startTime)}-${formatTimeLabel(draft.endTime)}`;
}

export default function ManagementPage() {
  const { user } = useAuthContext();

  const [packages, setPackages] = useState<CallPackage[]>([]);
  const [editingPackage, setEditingPackage] = useState<CallPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", duration: "15", price: "25", description: "" });
  const [availabilityForm, setAvailabilityForm] = useState<PackageAvailabilityDraft>(defaultAvailabilityDraft);
  const [availabilityByPackage, setAvailabilityByPackage] = useState<Record<string, PackageAvailabilitySummary>>({});
  const [formPackageId, setFormPackageId] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  const [creatorTimeZone, setCreatorTimeZone] = useState(getBrowserTimeZone());

  // Live rate state
  const [liveRate, setLiveRate] = useState<string>("");
  const [liveRateSaving, setLiveRateSaving] = useState(false);
  const [liveRateSaved, setLiveRateSaved] = useState(false);
  const [scheduledLiveAt, setScheduledLiveAt] = useState("");
  const [scheduledLiveTimeZone, setScheduledLiveTimeZone] = useState(getBrowserTimeZone());
  const [scheduledLiveAtIso, setScheduledLiveAtIso] = useState<string | null>(null);
  const [savingScheduledLive, setSavingScheduledLive] = useState(false);
  const [scheduledLiveSaved, setScheduledLiveSaved] = useState(false);
  const scheduledLiveSavedTimerRef = useRef<number | null>(null);
  const parsedLiveRate = parseFloat(liveRate);
  const isLiveRateFilled = liveRate.trim().length > 0;
  const isLiveRateValid =
    !isLiveRateFilled ||
    (Number.isFinite(parsedLiveRate) && parsedLiveRate >= MIN_LIVE_RATE_PER_MINUTE);

  const [toggleWarning, setToggleWarning] = useState<string | null>(null);
  const activePackageCount = packages.filter((p) => p.isActive).length;
  const atPackageCap = activePackageCount >= MAX_ACTIVE_PACKAGES;
  const parsedFormPrice = parseInt(form.price);
  const isFormPriceFilled = form.price.trim().length > 0;
  const isFormPriceValid =
    isFormPriceFilled &&
    Number.isFinite(parsedFormPrice) &&
    parsedFormPrice >= MIN_BOOKING_PRICE;
  const parsedFormDuration = parseInt(form.duration);
  const isFormDurationValid = BOOKING_DURATION_OPTIONS.includes(parsedFormDuration as typeof BOOKING_DURATION_OPTIONS[number]);
  const descriptionWordCount = countWords(form.description);
  const availabilityDayOfWeek = getDayIndexFromDate(availabilityForm.date);
  const isAvailabilityValid =
    availabilityDayOfWeek !== null &&
    Boolean(availabilityForm.startTime) &&
    Boolean(availabilityForm.endTime) &&
    availabilityForm.endTime > availabilityForm.startTime;

  const supabase = createClient();

  useEffect(() => {
    return () => {
      if (scheduledLiveSavedTimerRef.current) {
        window.clearTimeout(scheduledLiveSavedTimerRef.current);
      }
    };
  }, []);

  // Load packages + live join fee from Supabase on mount
  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: pkgs } = await supabase
        .from("call_packages")
        .select("id, name, duration, price, description, is_active, created_at")
        .eq("creator_id", user!.id)
        .order("created_at");

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, package_id")
        .eq("creator_id", user!.id);

      const { data: availability } = await supabase
        .from("creator_availability")
        .select("id, package_id, day_of_week, start_time, end_time")
        .eq("creator_id", user!.id)
        .not("package_id", "is", null)
        .order("day_of_week")
        .order("start_time");

      const bookingsByPackage = new Map<string, number>();
      (bookings ?? []).forEach((booking: any) => {
        if (!booking.package_id) return;
        bookingsByPackage.set(
          booking.package_id,
          (bookingsByPackage.get(booking.package_id) ?? 0) + 1
        );
      });

      if (pkgs) {
        setPackages(pkgs.map((p: any) => ({
          id: p.id,
          name: p.name,
          duration: p.duration,
          price: Number(p.price),
          description: p.description,
          isActive: p.is_active,
          bookingsCount: bookingsByPackage.get(p.id) ?? 0,
        })));
      }

      const availabilityMap: Record<string, PackageAvailabilitySummary> = {};
      (availability ?? []).forEach((slot: any) => {
        if (!slot.package_id || availabilityMap[slot.package_id]) return;
        availabilityMap[slot.package_id] = {
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: String(slot.start_time).slice(0, 5),
          endTime: String(slot.end_time).slice(0, 5),
        };
      });
      setAvailabilityByPackage(availabilityMap);

      let cp: {
        live_join_fee?: number | null;
        timezone?: string | null;
        scheduled_live_at?: string | null;
        scheduled_live_timezone?: string | null;
      } | null = null;
      const cpRes = await supabase
        .from("creator_profiles")
        .select("live_join_fee, timezone, scheduled_live_at, scheduled_live_timezone")
        .eq("id", user!.id)
        .single();

      if (cpRes.error) {
        const fallbackCpRes = await supabase
          .from("creator_profiles")
          .select("live_join_fee")
          .eq("id", user!.id)
          .single();
        cp = fallbackCpRes.data;
      } else {
        cp = cpRes.data;
      }

      if (cp?.live_join_fee != null) {
        setLiveRate(String(cp.live_join_fee));
      }
      const nextTimeZone = cp?.timezone || getBrowserTimeZone();
      const nextScheduledTimeZone = cp?.scheduled_live_timezone || nextTimeZone;
      setCreatorTimeZone(nextTimeZone);
      setScheduledLiveTimeZone(nextScheduledTimeZone);
      setScheduledLiveAtIso(cp?.scheduled_live_at ?? null);
      setScheduledLiveAt(
        cp?.scheduled_live_at
          ? formatDateTimeLocalInTimeZone(cp.scheduled_live_at, nextScheduledTimeZone)
          : ""
      );
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist packages to Supabase whenever they change
  useEffect(() => {
    if (!user || packages.length === 0) return;

    async function persist() {
      // Upsert all packages for this creator
      await supabase.from("call_packages").upsert(
        packages.map((p) => ({
          id: p.id,
          creator_id: user!.id,
          name: p.name,
          duration: p.duration,
          price: p.price,
          description: p.description,
          is_active: p.isActive,
          bookings_count: p.bookingsCount,
        })),
        { onConflict: "id" }
      );
    }

    persist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, user?.id]);

  async function saveLiveRate() {
    if (!user) return;
    if (!isLiveRateValid) return;
    setLiveRateSaving(true);
    const parsedRate = parseFloat(liveRate);
    const rate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null;
    const rateRes = await supabase
      .from("creator_profiles")
      .upsert({ id: user.id, live_join_fee: rate }, { onConflict: "id" });
    if (rateRes.error) {
      await supabase
        .from("creator_profiles")
        .upsert({ id: user.id, live_join_fee: rate }, { onConflict: "id" });
    }
    setLiveRateSaving(false);
    setLiveRateSaved(true);
    setTimeout(() => setLiveRateSaved(false), 2000);
  }

  function hasConfiguredLiveRate(value: string) {
    const parsedRate = parseFloat(value);
    return Number.isFinite(parsedRate) && parsedRate > 0;
  }

  async function saveScheduledLive(nextValue?: string) {
    if (!user) return;
    if (scheduledLiveSavedTimerRef.current) {
      window.clearTimeout(scheduledLiveSavedTimerRef.current);
      scheduledLiveSavedTimerRef.current = null;
    }
    setScheduledLiveSaved(false);
    setSavingScheduledLive(true);
    let scheduledLiveIso: string | null = null;

    if (nextValue) {
      const [datePart, timePart] = nextValue.split("T");
      if (datePart && timePart) {
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        scheduledLiveIso = zonedTimeToUtc(
          { year, month, day, hour, minute },
          scheduledLiveTimeZone
        ).toISOString();
      }
    }

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        scheduled_live_at: scheduledLiveIso,
        scheduled_live_timezone: nextValue ? scheduledLiveTimeZone : null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to save scheduled live time", error);
      setSavingScheduledLive(false);
      return;
    }

    setScheduledLiveAt(nextValue ?? "");
    setScheduledLiveAtIso(scheduledLiveIso);
    setSavingScheduledLive(false);
    setScheduledLiveSaved(true);
    scheduledLiveSavedTimerRef.current = window.setTimeout(() => {
      setScheduledLiveSaved(false);
      scheduledLiveSavedTimerRef.current = null;
    }, 2200);
  }

  function handleScheduledLiveDateTimeChange(value: string) {
    setScheduledLiveSaved(false);
    setScheduledLiveAt(value);
  }

  function handleScheduledLiveTimeZoneChange(value: string) {
    setScheduledLiveSaved(false);
    setScheduledLiveTimeZone(value);
  }

  function openNew() {
    const packageId = crypto.randomUUID();
    setForm({ name: "", duration: "15", price: "25", description: "" });
    setAvailabilityForm(defaultAvailabilityDraft());
    setFormPackageId(packageId);
    setEditingPackage(null);
    setShowForm(true);
  }

  function openEdit(pkg: CallPackage) {
    const packageAvailability = availabilityByPackage[pkg.id];
    setForm({
      name: pkg.name,
      duration: BOOKING_DURATION_OPTIONS.includes(pkg.duration as typeof BOOKING_DURATION_OPTIONS[number])
        ? String(pkg.duration)
        : "15",
      price: String(pkg.price),
      description: pkg.description,
    });
    setAvailabilityForm(
      packageAvailability
        ? {
            slotId: packageAvailability.id,
            date: getNextDateForDay(packageAvailability.dayOfWeek),
            startTime: packageAvailability.startTime,
            endTime: packageAvailability.endTime,
          }
        : defaultAvailabilityDraft()
    );
    setFormPackageId(pkg.id);
    setEditingPackage(pkg);
    setShowForm(true);
  }

  async function handleSave() {
    if (!user || !formPackageId || !isFormPriceValid || !isFormDurationValid || !isAvailabilityValid || descriptionWordCount > DESCRIPTION_WORD_LIMIT) return;
    setFormSaving(true);
    const packagePayload = {
      id: formPackageId,
      creator_id: user.id,
      name: form.name.trim(),
      duration: parsedFormDuration,
      price: parsedFormPrice,
      description: limitWords(form.description, DESCRIPTION_WORD_LIMIT),
      is_active: editingPackage?.isActive ?? true,
      bookings_count: editingPackage?.bookingsCount ?? 0,
    };

    const packageRes = await supabase.from("call_packages").upsert(packagePayload, { onConflict: "id" });
    if (packageRes.error) {
      setFormSaving(false);
      return;
    }

    const availabilityPayload = {
      creator_id: user.id,
      day_of_week: availabilityDayOfWeek,
      start_time: availabilityForm.startTime,
      end_time: availabilityForm.endTime,
      is_active: true,
      package_id: formPackageId,
    };

    let savedAvailabilityId = availabilityForm.slotId;
    if (availabilityForm.slotId) {
      await supabase
        .from("creator_availability")
        .update(availabilityPayload)
        .eq("id", availabilityForm.slotId)
        .eq("creator_id", user.id);
    } else {
      const availabilityRes = await supabase
        .from("creator_availability")
        .insert(availabilityPayload)
        .select("id")
        .single();
      savedAvailabilityId = availabilityRes.data?.id ?? null;
    }

    await supabase
      .from("creator_profiles")
      .upsert({
        id: user.id,
        timezone: creatorTimeZone,
        next_available: formatAvailabilitySummary(availabilityForm),
      }, { onConflict: "id" });

    if (editingPackage) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingPackage.id
            ? { ...p, name: form.name.trim(), duration: parsedFormDuration, price: parsedFormPrice, description: packagePayload.description }
            : p
        )
      );
    } else {
      const newPkg: CallPackage = {
        id: formPackageId,
        name: form.name.trim(),
        duration: parsedFormDuration,
        price: parsedFormPrice,
        description: packagePayload.description,
        isActive: true,
        bookingsCount: 0,
      };
      setPackages((prev) => [...prev, newPkg]);
    }
    if (savedAvailabilityId && availabilityDayOfWeek !== null) {
      setAvailabilityByPackage((prev) => ({
        ...prev,
        [formPackageId]: {
          id: savedAvailabilityId,
          dayOfWeek: availabilityDayOfWeek,
          startTime: availabilityForm.startTime,
          endTime: availabilityForm.endTime,
        },
      }));
    }
    setFormSaving(false);
    setShowForm(false);
  }

  function toggleActive(id: string) {
    setPackages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && !target.isActive) {
        const activeCount = prev.filter((p) => p.isActive).length;
        if (activeCount >= MAX_ACTIVE_PACKAGES) {
          setToggleWarning(
            `You can only have ${MAX_ACTIVE_PACKAGES} active bookings at a time. Disable another first.`
          );
          setTimeout(() => setToggleWarning(null), 3500);
          return prev;
        }
      }
      return prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p));
    });
  }

  async function deletePackage(id: string) {
    if (!user) return;
    setToggleWarning(null);
    setDeletingPackageId(id);

    const { error: bookingDetachError } = await supabase
      .from("bookings")
      .update({ package_id: null })
      .eq("creator_id", user.id)
      .eq("package_id", id);

    if (bookingDetachError) {
      setToggleWarning("Could not delete this booking yet. Please try again.");
      setDeletingPackageId(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("call_packages")
      .delete()
      .eq("creator_id", user.id)
      .eq("id", id);

    if (deleteError) {
      setToggleWarning("Could not delete this booking yet. Please try again.");
      setDeletingPackageId(null);
      return;
    }

    setPackages((prev) => prev.filter((p) => p.id !== id));
    setAvailabilityByPackage((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDeletingPackageId(null);
  }

  return (
    <>
      <div className="px-4 md:px-8 py-3 max-w-4xl mx-auto space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">Manage Offerings</h1>
            <p className="text-brand-ink-subtle mt-1">Set your bookings, pricing, and descriptions.</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              variant="primary"
              onClick={openNew}
              disabled={atPackageCap}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Booking
            </Button>
            <p className="text-xs text-brand-ink-subtle">
              Up to {MAX_ACTIVE_PACKAGES} active bookings.
            </p>
          </div>
        </div>

        {toggleWarning && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {toggleWarning}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
          {[
            { label: "Active Bookings", value: packages.filter((p) => p.isActive).length, icon: CheckCircle2 },
            { label: "Total Bookings", value: packages.reduce((s, p) => s + p.bookingsCount, 0), icon: DollarSign },
            { label: "Price Range", value: packages.length ? `$${Math.min(...packages.map((p) => p.price))}–$${Math.max(...packages.map((p) => p.price))}` : "—", icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                <Icon className="w-5 h-5 text-brand-primary-light mb-3" />
                <p className="text-2xl font-display font-bold text-brand-ink">{s.value}</p>
                <p className="text-xs text-brand-ink-subtle mt-1">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-brand-ink">Your Bookings</h2>
          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center">
              <DollarSign className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
              <p className="text-brand-ink-subtle font-medium">No bookings yet</p>
              <p className="text-brand-ink-subtle text-sm mt-1">Create your first booking to start accepting bookings.</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                availability={availabilityByPackage[pkg.id]}
                deleting={deletingPackageId === pkg.id}
                onEdit={() => openEdit(pkg)}
                onToggle={() => toggleActive(pkg.id)}
                onDelete={() => deletePackage(pkg.id)}
              />
            ))
          )}
        </div>

        {/* ── Live Rate ── */}
        <ScheduledLiveCard
          scheduledLiveAt={scheduledLiveAt}
          scheduledLiveTimeZone={scheduledLiveTimeZone}
          scheduledLiveAtIso={scheduledLiveAtIso}
          liveRateConfigured={hasConfiguredLiveRate(liveRate)}
          saving={savingScheduledLive}
          saved={scheduledLiveSaved}
          onChangeDateTime={handleScheduledLiveDateTimeChange}
          onChangeTimeZone={handleScheduledLiveTimeZoneChange}
          onSave={() => void saveScheduledLive(scheduledLiveAt)}
          onClear={() => void saveScheduledLive("")}
        />

        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-brand-live" />
            <h2 className="text-lg font-bold text-brand-ink">Friendsly Live rate</h2>
          </div>
          <p className="text-sm text-brand-ink-subtle mb-5">
            Fans can watch and chat for free. Set the amount charged per minute when a fan is brought on stage during your live.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-xs sm:flex-1">
              <label className="text-sm font-medium text-brand-ink-muted mb-2 block">
                Per Minute Rate (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-subtle text-sm">$</span>
                <input
                  type="number"
                  min={MIN_LIVE_RATE_PER_MINUTE}
                  step="0.10"
                  placeholder="Enter amount"
                  value={liveRate}
                  onChange={(e) => setLiveRate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated pl-7 pr-3 text-sm text-brand-ink placeholder:text-brand-ink-subtle focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              <p className="mt-2 text-xs text-brand-ink-subtle">
                Minimum ${MIN_LIVE_RATE_PER_MINUTE} per minute.
              </p>
              {isLiveRateFilled && !isLiveRateValid && (
                <p className="mt-1 text-xs text-red-400">
                  Per-minute rate must be at least ${MIN_LIVE_RATE_PER_MINUTE}.
                </p>
              )}
            </div>
            <Button
              variant={liveRateSaved ? "surface" : "primary"}
              onClick={saveLiveRate}
              disabled={liveRateSaving || !isLiveRateValid}
              className="w-full sm:mb-0.5 sm:w-auto"
            >
              {liveRateSaving ? "Saving…" : liveRateSaved ? "Saved ✓" : "Save Rate"}
            </Button>
          </div>
          {liveRate && parseFloat(liveRate) > 0 && (
            <p className="text-xs text-brand-live mt-3">
              Fans will see &quot;{formatCurrency(parseFloat(liveRate))} per minute&quot; on your profile and discover card.
            </p>
          )}
        </div>

      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogContent
          title={editingPackage ? "Edit Booking" : "Create Booking"}
          description="Set the session, price, and fan-facing description."
          className="max-w-2xl"
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            <Input
              label="Booking Name"
              placeholder="e.g. Quick Chat, Deep Dive, VIP Hour"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-brand-ink-muted mb-1.5 block">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BOOKING_DURATION_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setForm({ ...form, duration: String(minutes) })}
                      className={cn(
                        "h-10 rounded-xl border text-sm font-semibold transition-all",
                        form.duration === String(minutes)
                          ? "border-brand-primary bg-brand-primary/15 text-brand-primary-light"
                          : "border-brand-border bg-brand-surface text-brand-ink-subtle hover:border-brand-primary/40 hover:text-brand-ink"
                      )}
                    >
                      {minutes}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-brand-ink-subtle">
                  Bookings are offered in 15-minute increments.
                </p>
              </div>
              <div>
                <Input
                  label="Price (USD)"
                  type="number"
                  min={MIN_BOOKING_PRICE}
                  placeholder="25"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  icon={<DollarSign className="w-4 h-4" />}
                />
                <p className="mt-1.5 text-xs text-brand-ink-subtle">
                  Minimum ${MIN_BOOKING_PRICE}.
                </p>
                {isFormPriceFilled && !isFormPriceValid && (
                  <p className="mt-1 text-xs text-red-400">
                    Price must be at least ${MIN_BOOKING_PRICE}.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary-light">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">Booking Availability</p>
                  <p className="mt-1 text-xs leading-5 text-brand-ink-subtle">
                    Pick a calendar date and time window. Fans will see this booking on the matching weekday each week.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Calendar Date"
                  type="date"
                  value={availabilityForm.date}
                  onChange={(e) => setAvailabilityForm((current) => ({ ...current, date: e.target.value }))}
                  className="mobile-native-field [color-scheme:light]"
                />
                <Input
                  label="Start Time"
                  type="time"
                  value={availabilityForm.startTime}
                  onChange={(e) => setAvailabilityForm((current) => ({ ...current, startTime: e.target.value }))}
                  className="mobile-native-field [color-scheme:light]"
                />
                <Input
                  label="End Time"
                  type="time"
                  value={availabilityForm.endTime}
                  onChange={(e) => setAvailabilityForm((current) => ({ ...current, endTime: e.target.value }))}
                  className="mobile-native-field [color-scheme:light]"
                />
              </div>

              <div className="mt-3 rounded-xl border border-brand-border bg-brand-elevated px-3 py-2 text-xs text-brand-ink-subtle">
                {isAvailabilityValid
                  ? `This booking will be available ${formatAvailabilitySummary(availabilityForm)}.`
                  : "Choose a valid date and an end time later than the start time."}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-ink-muted mb-2 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: limitWords(e.target.value, DESCRIPTION_WORD_LIMIT) })}
                placeholder="What will fans get from this session?"
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              <p className={cn("mt-1 text-xs", descriptionWordCount > DESCRIPTION_WORD_LIMIT ? "text-red-400" : "text-brand-ink-subtle")}>
                {descriptionWordCount}/{DESCRIPTION_WORD_LIMIT} words
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={formSaving || !form.name.trim() || !isFormDurationValid || !isFormPriceValid || !isAvailabilityValid || descriptionWordCount > DESCRIPTION_WORD_LIMIT}
                onClick={() => void handleSave()}
              >
                {formSaving ? "Saving..." : editingPackage ? "Save Changes" : "Create Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackageCard({ pkg, availability, deleting, onEdit, onToggle, onDelete }: {
  pkg: CallPackage;
  availability?: PackageAvailabilitySummary;
  deleting: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const formattedPackagePrice = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pkg.price);
  const availabilityLabel = availability
    ? `${DAY_LABELS[availability.dayOfWeek]}s ${formatTimeLabel(availability.startTime)}-${formatTimeLabel(availability.endTime)}`
    : "Availability not set";

  return (
    <div className={cn("rounded-2xl border bg-brand-surface p-5 transition-all", pkg.isActive ? "border-brand-border hover:border-brand-primary/30" : "border-brand-border opacity-60")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="text-base font-bold text-brand-ink">{pkg.name}</h3>
            <Badge variant={pkg.isActive ? "live" : "default"} className="text-[11px]">
              {pkg.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-brand-ink-subtle leading-relaxed">{pkg.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-brand-ink-subtle">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{pkg.duration} min</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formattedPackagePrice} per session</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{availabilityLabel}</span>
            <span>{pkg.bookingsCount} bookings</span>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-elevated px-2 text-xs font-semibold text-brand-ink-subtle transition-colors hover:border-brand-primary/40 hover:text-brand-primary-light sm:h-10 sm:w-10 sm:p-0"
            title={pkg.isActive ? "Deactivate" : "Activate"}
            aria-label={pkg.isActive ? "Deactivate booking" : "Activate booking"}
          >
            {pkg.isActive ? <ToggleRight className="w-5 h-5 text-brand-live" /> : <ToggleLeft className="w-5 h-5" />}
            <span className="sm:sr-only">{pkg.isActive ? "Disable" : "Enable"}</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-elevated px-2 text-xs font-semibold text-brand-ink-subtle transition-colors hover:border-brand-primary/40 hover:text-brand-ink sm:h-10 sm:w-10 sm:p-0"
            title="Edit booking"
            aria-label="Edit booking"
          >
            <Edit2 className="w-4 h-4" />
            <span className="sm:sr-only">Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-elevated px-2 text-xs font-semibold text-brand-ink-subtle transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-wait disabled:opacity-60 sm:h-10 sm:w-10 sm:p-0"
            title="Delete booking"
            aria-label="Delete booking"
          >
            <Trash2 className="w-4 h-4" />
            <span className="sm:sr-only">{deleting ? "Deleting" : "Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
