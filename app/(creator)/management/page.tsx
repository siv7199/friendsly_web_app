"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, DollarSign,
  Clock, CheckCircle2, ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CallPackage } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { COMMON_TIME_ZONES, formatTimeZoneLabel, getBrowserTimeZone } from "@/lib/timezones";

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  package_id: string | null;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

export default function ManagementPage() {
  const { user } = useAuthContext();

  const [packages, setPackages] = useState<CallPackage[]>([]);
  const [editingPackage, setEditingPackage] = useState<CallPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", duration: "15", price: "25", description: "" });

  // Live rate state
  const [liveRate, setLiveRate] = useState<string>("");
  const [liveRateSaving, setLiveRateSaving] = useState(false);
  const [liveRateSaved, setLiveRateSaved] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [creatorTimeZone, setCreatorTimeZone] = useState(getBrowserTimeZone());

  const supabase = createClient();

  // Load packages + live rate from Supabase on mount
  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: pkgs } = await supabase
        .from("call_packages")
        .select("*")
        .eq("creator_id", user!.id)
        .order("created_at");

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, package_id")
        .eq("creator_id", user!.id);

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

      let cp: { live_rate_per_minute?: number | null; timezone?: string | null } | null = null;
      const cpRes = await supabase
        .from("creator_profiles")
        .select("live_rate_per_minute, timezone")
        .eq("id", user!.id)
        .single();

      if (cpRes.error) {
        const fallbackCpRes = await supabase
          .from("creator_profiles")
          .select("live_rate_per_minute")
          .eq("id", user!.id)
          .single();
        cp = fallbackCpRes.data;
      } else {
        cp = cpRes.data;
      }

      if (cp?.live_rate_per_minute != null) {
        setLiveRate(String(cp.live_rate_per_minute));
      }
      if (cp?.timezone) {
        setCreatorTimeZone(cp.timezone);
      }

      let availability: any[] | null = null;
      const availabilityRes = await supabase
        .from("creator_availability")
        .select("id, day_of_week, start_time, end_time, is_active, package_id")
        .eq("creator_id", user!.id)
        .order("day_of_week")
        .order("start_time");

      if (availabilityRes.error) {
        const fallbackAvailabilityRes = await supabase
          .from("creator_availability")
          .select("id, day_of_week, start_time, end_time, is_active")
          .eq("creator_id", user!.id)
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
    setLiveRateSaving(true);
    const rate = parseFloat(liveRate) || null;
    await supabase
      .from("creator_profiles")
      .upsert({ id: user.id, live_rate_per_minute: rate }, { onConflict: "id" });
    setLiveRateSaving(false);
    setLiveRateSaved(true);
    setTimeout(() => setLiveRateSaved(false), 2000);
  }

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
    if (!user) return;

    setAvailabilitySaving(true);

    await supabase
      .from("creator_availability")
      .delete()
      .eq("creator_id", user.id);

    const validSlots = availabilitySlots.filter(
      (slot) => slot.is_active && slot.start_time && slot.end_time && slot.end_time > slot.start_time
    );

    if (validSlots.length > 0) {
      const insertPayload = validSlots.map((slot) => ({
        creator_id: user.id,
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
            creator_id: user.id,
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
      .upsert({ id: user.id, next_available: nextAvailableLabel(validSlots), timezone: creatorTimeZone }, { onConflict: "id" });

    if (profileUpdateRes.error) {
      await supabase
        .from("creator_profiles")
        .upsert({ id: user.id, next_available: nextAvailableLabel(validSlots) }, { onConflict: "id" });
    }

    setAvailabilitySaving(false);
    setAvailabilitySaved(true);
    setTimeout(() => setAvailabilitySaved(false), 2000);
  }

  const hasInvalidAvailability = availabilitySlots.some(
    (slot) => !slot.start_time || !slot.end_time || slot.end_time <= slot.start_time
  );

  function openNew() {
    setForm({ name: "", duration: "15", price: "25", description: "" });
    setEditingPackage(null);
    setShowForm(true);
  }

  function openEdit(pkg: CallPackage) {
    setForm({
      name: pkg.name,
      duration: String(pkg.duration),
      price: String(pkg.price),
      description: pkg.description,
    });
    setEditingPackage(pkg);
    setShowForm(true);
  }

  function handleSave() {
    if (editingPackage) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingPackage.id
            ? { ...p, name: form.name, duration: parseInt(form.duration), price: parseInt(form.price), description: form.description }
            : p
        )
      );
    } else {
      const newPkg: CallPackage = {
        id: crypto.randomUUID(),
        name: form.name,
        duration: parseInt(form.duration),
        price: parseInt(form.price),
        description: form.description,
        isActive: true,
        bookingsCount: 0,
      };
      setPackages((prev) => [...prev, newPkg]);
    }
    setShowForm(false);
  }

  function toggleActive(id: string) {
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p)));
  }

  async function deletePackage(id: string) {
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setAvailabilitySlots((prev) => prev.map((slot) => (
      slot.package_id === id ? { ...slot, package_id: null } : slot
    )));
    await supabase.from("call_packages").delete().eq("id", id);
  }

  return (
    <>
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-100">Manage Offerings</h1>
            <p className="text-slate-400 mt-1">Set your call packages, pricing, and availability.</p>
          </div>
          <Button variant="primary" onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            New Package
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Packages", value: packages.filter((p) => p.isActive).length, icon: CheckCircle2 },
            { label: "Total Bookings", value: packages.reduce((s, p) => s + p.bookingsCount, 0), icon: DollarSign },
            { label: "Price Range", value: packages.length ? `$${Math.min(...packages.map((p) => p.price))}–$${Math.max(...packages.map((p) => p.price))}` : "—", icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                <Icon className="w-5 h-5 text-brand-primary-light mb-3" />
                <p className="text-2xl font-black text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100">Your Packages</h2>
          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center">
              <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No packages yet</p>
              <p className="text-slate-500 text-sm mt-1">Create your first call package to start accepting bookings.</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onEdit={() => openEdit(pkg)}
                onToggle={() => toggleActive(pkg.id)}
                onDelete={() => deletePackage(pkg.id)}
              />
            ))
          )}
        </div>

        {/* ── Live Rate ── */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-brand-live" />
            <h2 className="text-lg font-bold text-slate-100">Public Live Rate</h2>
          </div>
          <p className="text-sm text-slate-400 mb-5">
            When you go live, fans join your queue and are charged this rate per minute for the time
            they&apos;re on the call with you. Set to blank to disable live queue billing.
          </p>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Rate per minute (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0.10"
                  step="0.10"
                  placeholder="e.g. 1.50"
                  value={liveRate}
                  onChange={(e) => setLiveRate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated pl-7 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>
            </div>
            <Button
              variant={liveRateSaved ? "surface" : "primary"}
              onClick={saveLiveRate}
              disabled={liveRateSaving}
              className="mb-0.5"
            >
              {liveRateSaving ? "Saving…" : liveRateSaved ? "Saved ✓" : "Save Rate"}
            </Button>
          </div>
          {liveRate && parseFloat(liveRate) > 0 && (
            <p className="text-xs text-brand-live mt-3">
              Fans will see &quot;{formatCurrency(parseFloat(liveRate))}/min&quot; on your profile and discover card.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Weekly Availability</h2>
              <p className="text-sm text-slate-400 mt-1">
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
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Your Time Zone
            </label>
            <select
              value={creatorTimeZone}
              onChange={(e) => setCreatorTimeZone(e.target.value)}
              className="w-full max-w-sm h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary"
            >
              {COMMON_TIME_ZONES.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {formatTimeZoneLabel(timeZone)}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Fans will see these slots converted into their own local time automatically.
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
                      <h3 className="text-sm font-semibold text-slate-100">{dayLabel}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
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
                    <div className="mt-3 rounded-xl border border-dashed border-brand-border px-4 py-3 text-sm text-slate-500">
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
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-end">
                              <div>
                                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                                  Start
                                </label>
                                <input
                                  type="time"
                                  value={slot.start_time}
                                  onChange={(e) => updateAvailabilitySlot(slot.id, "start_time", e.target.value)}
                                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                                  End
                                </label>
                                <input
                                  type="time"
                                  value={slot.end_time}
                                  onChange={(e) => updateAvailabilitySlot(slot.id, "end_time", e.target.value)}
                                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                                  Offering
                                </label>
                                <select
                                  value={slot.package_id ?? ""}
                                  onChange={(e) => updateAvailabilitySlot(slot.id, "package_id", e.target.value)}
                                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary"
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
                                className="text-slate-400 hover:text-red-400"
                                onClick={() => removeAvailabilitySlot(slot.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {isInvalid && (
                              <p className="mt-2 text-xs text-red-300">
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

          <p className="text-xs text-slate-500 mt-4">
            Fans will see these recurring weekly windows on your profile when booking calls.
          </p>
        </div>
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogContent
          title={editingPackage ? "Edit Package" : "Create Package"}
          description="Define what fans are booking when they choose this option."
        >
          <div className="space-y-4">
            <Input
              label="Package Name"
              placeholder="e.g. Quick Chat, Deep Dive, VIP Hour"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Duration (minutes)"
                type="number"
                placeholder="15"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
              <Input
                label="Price (USD)"
                type="number"
                placeholder="25"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                icon={<DollarSign className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What will fans get from this session?"
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!form.name || !form.price || !form.duration}
                onClick={handleSave}
              >
                {editingPackage ? "Save Changes" : "Create Package"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackageCard({ pkg, onEdit, onToggle, onDelete }: {
  pkg: CallPackage; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={cn("rounded-2xl border bg-brand-surface p-5 transition-all", pkg.isActive ? "border-brand-border hover:border-brand-primary/30" : "border-brand-border opacity-60")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-bold text-slate-100">{pkg.name}</h3>
            <Badge variant={pkg.isActive ? "live" : "default"} className="text-[11px]">
              {pkg.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{pkg.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{pkg.duration} min</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatCurrency(pkg.price)} per session</span>
            <span>{pkg.bookingsCount} bookings</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onToggle} className="p-2 rounded-lg text-slate-400 hover:text-brand-primary-light hover:bg-brand-elevated transition-colors" title={pkg.isActive ? "Deactivate" : "Activate"}>
            {pkg.isActive ? <ToggleRight className="w-5 h-5 text-brand-live" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-brand-elevated transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
