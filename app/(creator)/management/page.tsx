"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, DollarSign,
  Clock, CheckCircle2, ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CallPackage } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { LIVE_MIN_JOIN_FEE } from "@/lib/live";

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
  const parsedLiveRate = parseFloat(liveRate);
  const isLiveRateFilled = liveRate.trim().length > 0;
  const isLiveRateValid = !isLiveRateFilled || (Number.isFinite(parsedLiveRate) && parsedLiveRate >= LIVE_MIN_JOIN_FEE);

  const supabase = createClient();

  // Load packages + live join fee from Supabase on mount
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

      let cp: { live_join_fee?: number | null } | null = null;
      const cpRes = await supabase
        .from("creator_profiles")
        .select("live_join_fee")
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
    const rate = Number.isFinite(parsedRate) && parsedRate >= LIVE_MIN_JOIN_FEE ? parsedRate : null;
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
    await supabase.from("call_packages").delete().eq("id", id);
  }

  return (
    <>
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black font-display text-brand-ink">Manage Offerings</h1>
            <p className="text-brand-ink-subtle mt-1">Set your call packages, pricing, and availability.</p>
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
                <p className="text-2xl font-black text-brand-ink">{s.value}</p>
                <p className="text-xs text-brand-ink-subtle mt-1">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-brand-ink">Your Packages</h2>
          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center">
              <DollarSign className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
              <p className="text-brand-ink-subtle font-medium">No packages yet</p>
              <p className="text-brand-ink-subtle text-sm mt-1">Create your first call package to start accepting bookings.</p>
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
            <h2 className="text-lg font-bold text-brand-ink">Public Live Join Fee</h2>
          </div>
          <p className="text-sm text-brand-ink-subtle mb-5">
            Fans can watch and chat for free. This is the one-time fee they pay to request a 30-second on-stage spot during your live.
          </p>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium text-brand-ink-muted mb-2 block">
                Join fee (USD, minimum $10)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-subtle text-sm">$</span>
                <input
                  type="number"
                  min={String(LIVE_MIN_JOIN_FEE)}
                  step="0.10"
                  placeholder={`Minimum ${LIVE_MIN_JOIN_FEE.toFixed(2)}`}
                  value={liveRate}
                  onChange={(e) => setLiveRate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated pl-7 pr-3 text-sm text-brand-ink placeholder:text-brand-ink-subtle focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              <p className="mt-2 text-xs text-amber-300">
                Minimum live join fee: {formatCurrency(LIVE_MIN_JOIN_FEE)}
              </p>
              {isLiveRateFilled && !isLiveRateValid && (
                <p className="mt-2 text-xs text-red-400">
                  Enter at least {formatCurrency(LIVE_MIN_JOIN_FEE)} to save a live join fee.
                </p>
              )}
            </div>
            <Button
              variant={liveRateSaved ? "surface" : "primary"}
              onClick={saveLiveRate}
              disabled={liveRateSaving || !isLiveRateValid}
              className="mb-0.5"
            >
              {liveRateSaving ? "Saving…" : liveRateSaved ? "Saved ✓" : "Save Rate"}
            </Button>
          </div>
          {liveRate && parseFloat(liveRate) > 0 && (
            <p className="text-xs text-brand-live mt-3">
              Fans will see &quot;{formatCurrency(parseFloat(liveRate))} to join live for 30 seconds&quot; on your profile and discover card. Fees below {formatCurrency(LIVE_MIN_JOIN_FEE)} won&apos;t be used for live joining.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-brand-ink">Weekly Availability</h2>
            <p className="text-sm text-brand-ink-subtle mt-1">
              Availability editing now lives on your calendar page.
            </p>
          </div>
          <Link href="/calendar">
            <Button variant="outline">Open Calendar</Button>
          </Link>
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
              <label className="text-sm font-medium text-brand-ink-muted mb-2 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What will fans get from this session?"
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
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
            <h3 className="text-base font-bold text-brand-ink">{pkg.name}</h3>
            <Badge variant={pkg.isActive ? "live" : "default"} className="text-[11px]">
              {pkg.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-brand-ink-subtle leading-relaxed">{pkg.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-brand-ink-subtle">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{pkg.duration} min</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatCurrency(pkg.price)} per session</span>
            <span>{pkg.bookingsCount} bookings</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onToggle} className="p-2 rounded-lg text-brand-ink-subtle hover:text-brand-primary-light hover:bg-brand-elevated transition-colors" title={pkg.isActive ? "Deactivate" : "Activate"}>
            {pkg.isActive ? <ToggleRight className="w-5 h-5 text-brand-live" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-brand-ink-subtle hover:text-brand-ink hover:bg-brand-elevated transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-brand-ink-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
