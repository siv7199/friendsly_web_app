"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, DollarSign,
  Clock, CheckCircle2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MOCK_CALL_PACKAGES } from "@/lib/mock-data";
import type { CallPackage } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { saveCreatorPackages, getCreatorPackages } from "@/lib/mock-auth";

export default function ManagementPage() {
  const { user } = useAuthContext();
  const isDemo = user?.id === "1";

  const [packages, setPackages] = useState<CallPackage[]>([]);
  const [editingPackage, setEditingPackage] = useState<CallPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", duration: "15", price: "25", description: "" });

  // Load packages from localStorage on mount
  useEffect(() => {
    if (!user) return;
    if (isDemo) {
      // Demo creator: use mock data as seed if no saved packages yet
      const saved = getCreatorPackages(user.id);
      setPackages(saved.length > 0 ? saved : MOCK_CALL_PACKAGES);
    } else {
      setPackages(getCreatorPackages(user.id));
    }
  }, [user, isDemo]);

  // Persist whenever packages change
  useEffect(() => {
    if (!user || packages.length === 0 && !isDemo) return;
    saveCreatorPackages(user.id, packages);
  }, [packages, user, isDemo]);

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
        id: Date.now().toString(),
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

  function deletePackage(id: string) {
    setPackages((prev) => prev.filter((p) => p.id !== id));
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

        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Availability Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Max daily bookings</label>
              <select className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary">
                {[3, 5, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>{n} per day</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Advance booking window</label>
              <select className="w-full h-10 rounded-xl border border-brand-border bg-brand-elevated px-3 text-sm text-slate-100 focus:outline-none focus:border-brand-primary">
                {["1 week", "2 weeks", "1 month", "3 months"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <Button variant="surface" className="mt-4">Save Settings</Button>
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
