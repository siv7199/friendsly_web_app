"use client";

/**
 * Settings Page  (route: /settings)
 *
 * Two tabs: Account and Billing.
 * All saves are to localStorage via updateProfile() — changes reflect
 * instantly in the sidebar because they share the same AuthContext state.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, DollarSign,
  CreditCard, CheckCircle2, Save, Loader2,
  Shield, Trash2, Camera, ArrowLeft, X, Instagram, Music2,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/context/AuthContext";
import { isCreatorProfile } from "@/types";
import { AVATAR_COLORS, CREATOR_CATEGORIES } from "@/lib/mock-auth";
import { cn, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { deriveBookingStatus, getBookingGrossAmount, hasBookingEnded, shouldAutoCancelBooking } from "@/lib/bookings";
import { sanitizeSocialUrl } from "@/lib/social";
import { removeAvatarFile, uploadAvatarFile } from "@/lib/avatar-upload";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#7C3AED",
    colorBackground: "#1A1535",
    colorText: "#f1f5f9",
    colorTextSecondary: "#c4b5fd",
    colorTextPlaceholder: "#7c6fa0",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
  rules: {
    ".Label": {
      color: "#c4b5fd",
      fontWeight: "500",
    },
    ".Input": {
      borderColor: "rgba(124,92,231,0.35)",
      color: "#f1f5f9",
    },
    ".Input--focused": {
      borderColor: "#7C3AED",
      boxShadow: "0 0 0 2px rgba(124,92,231,0.2)",
    },
    ".Input--invalid": {
      borderColor: "#f87171",
      color: "#fca5a5",
    },
    ".Error": {
      color: "#fca5a5",
    },
  },
};

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// Billing form lives inside <Elements>
interface AddCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCardForm({ onSuccess, onCancel }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!stripe || !elements) return;
    setSaving(true);
    setError("");

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Could not save card.");
      setSaving(false);
      return;
    }

    if (!setupIntent) {
      setError("Could not save card.");
      setSaving(false);
      return;
    }

    onSuccess();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1 gap-2" onClick={handleSave} disabled={saving || !stripe}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Card"}
        </Button>
      </div>
    </div>
  );
}

type Tab = "account" | "billing";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, updateProfile, logout, deleteAccount } = useAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Billing / card state
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [removingPaymentMethodId, setRemovingPaymentMethodId] = useState<string | null>(null);
  const [billingError, setBillingError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());

  // Financial state
  const [earnings, setEarnings] = useState({ available: 0, pending: 0, thisMonth: 0, totalEarned: 0 });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loadingFinancials, setLoadingFinancials] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Form state seeded from live auth data
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    bio: "",
    category: CREATOR_CATEGORIES[0] as string,
    avatar_color: "",
    avatar_url: "",
    instagram_url: "",
    tiktok_url: "",
    x_url: "",
  });

  async function loadPaymentMethods() {
    if (!user) return;
    setLoadingPaymentMethods(true);
    setBillingError("");
    try {
      const res = await fetch("/api/payment-methods");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to load payment methods.");
      }
      setSavedPaymentMethods(data.paymentMethods ?? []);
    } catch (err) {
      setSavedPaymentMethods([]);
      setBillingError(err instanceof Error ? err.message : "Unable to load payment methods.");
    } finally {
      setLoadingPaymentMethods(false);
    }
  }

  useEffect(() => {
    if (!user || activeTab !== "billing") return;
    loadPaymentMethods();
  }, [user, activeTab]);

  // Load backend stats
  useEffect(() => {
    // Only run if it's a creator viewing the billing tab
    if (!user || !isCreatorProfile(user) || activeTab !== "billing") return;
    
    async function loadFinancials() {
      setLoadingFinancials(true);
      const supabase = createClient();
      
      const [bookingsRes, payoutsRes, liveRes] = await Promise.all([
        supabase.from("bookings").select("id, price, scheduled_at, duration, status, creator_present, fan_present, late_fee_amount, late_fee_paid_at").eq("creator_id", user!.id),
        supabase.from("payouts").select("*").eq("creator_id", user!.id).order('created_at', { ascending: false }),
        supabase
          .from("live_sessions")
          .select("id, live_queue_entries(id, status, amount_charged, ended_at)")
          .eq("creator_id", user!.id)
      ]);
      
      let totalEarned = 0;
      let monthEarned = 0;
      const now = new Date();
      const expiredIds: string[] = [];
      
      (bookingsRes.data || []).forEach((b: any) => {
        const grossBookingAmount = getBookingGrossAmount(
          Number(b.price),
          b.late_fee_amount,
          b.late_fee_paid_at
        );
        const normalizedStatus = deriveBookingStatus(
          b.status,
          b.scheduled_at,
          b.duration,
          now,
          b.creator_present,
          b.fan_present
        );
        if (
          normalizedStatus === "completed" &&
          b.status !== "completed" &&
          hasBookingEnded(b.scheduled_at, b.duration, now)
        ) {
          expiredIds.push(b.id);
        }
        if (normalizedStatus === "completed" || normalizedStatus === "upcoming" || normalizedStatus === "live") {
          const cut = grossBookingAmount * 0.85; // 85% cut calculation
          totalEarned += cut;
          const bDate = new Date(b.scheduled_at);
          if (
            normalizedStatus === "completed" &&
            bDate.getMonth() === now.getMonth() &&
            bDate.getFullYear() === now.getFullYear()
          ) {
            monthEarned += cut;
          }
        }
      });

      if (expiredIds.length > 0) {
        await supabase
          .from("bookings")
          .update({ status: "completed" })
          .in("id", expiredIds);
      }
      (liveRes.data || []).forEach((session: any) => {
        (session.live_queue_entries || []).forEach((entry: any) => {
          if ((entry.status === "completed" || entry.status === "skipped") && entry.amount_charged) {
            const cut = Number(entry.amount_charged) * 0.85;
            totalEarned += cut;

            const endedAt = entry.ended_at ? new Date(entry.ended_at) : null;
            if (endedAt && endedAt.getMonth() === now.getMonth() && endedAt.getFullYear() === now.getFullYear()) {
              monthEarned += cut;
            }
          }
        });
      });
      
      let pendingWithdrawals = 0;
      let totalWithdrawn = 0;
      
      (payoutsRes.data || []).forEach((p: any) => {
        if (p.status === "pending" || p.status === "processing") pendingWithdrawals += Number(p.amount);
        if (p.status === "completed") totalWithdrawn += Number(p.amount);
      });
      
      const available = Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawals);
      
      setEarnings({
        available,
        pending: pendingWithdrawals,
        thisMonth: monthEarned,
        totalEarned
      });
      
      setPayouts(payoutsRes.data || []);
      setLoadingFinancials(false);
    }
    
    loadFinancials();
  }, [user, activeTab]);

  async function handleAddCard() {
    setLoadingSetup(true);
    setBillingError("");
    try {
      const res = await fetch("/api/create-setup-intent", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to start card setup.");
      }
      setSetupClientSecret(data.clientSecret);
      setShowAddCard(true);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Unable to start card setup.");
      setShowAddCard(false);
      setSetupClientSecret(null);
    } finally {
      setLoadingSetup(false);
    }
  }

  async function handleCardSaved() {
    setShowAddCard(false);
    setSetupClientSecret(null);
    await loadPaymentMethods();
  }

  async function handleRemoveCard(paymentMethodId: string) {
    setRemovingPaymentMethodId(paymentMethodId);
    setBillingError("");
    try {
      const res = await fetch('/api/payment-methods/' + paymentMethodId, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to remove card.");
      }
      await loadPaymentMethods();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Unable to remove card.");
    } finally {
      setRemovingPaymentMethodId(null);
    }
  }

  async function handleWithdraw() {
    if (!user || earnings.available <= 0) return;
    setIsWithdrawing(true);
    const amountToWithdraw = earnings.available;

    const res = await fetch("/api/creator-payouts/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountToWithdraw }),
    });
    const data = await res.json();

    if (res.ok && data.payout) {
      setPayouts((prev) => [data.payout, ...prev.filter((item) => item.id !== data.payout.id)]);
      setEarnings((prev) => ({
        ...prev,
        available: 0,
        pending: prev.pending + amountToWithdraw,
      }));
    }

    setIsWithdrawing(false);
  }

  // Sync form when user loads from context
  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        username: user.username,
        bio: isCreatorProfile(user) ? user.bio ?? "" : "",
        category: isCreatorProfile(user) ? user.category ?? CREATOR_CATEGORIES[0] : CREATOR_CATEGORIES[0],
        avatar_color: user.avatar_color,
        avatar_url: user.avatar_url ?? "",
        instagram_url: isCreatorProfile(user) ? user.instagram_url ?? "" : "",
        tiktok_url: isCreatorProfile(user) ? user.tiktok_url ?? "" : "",
        x_url: isCreatorProfile(user) ? user.x_url ?? "" : "",
      });
    }
  }, [user]);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAvatarSelected(file?: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const avatarUrl = await uploadAvatarFile(file);
      update("avatar_url", avatarUrl);
      setAvatarVersion(Date.now());
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarRemoved() {
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      await removeAvatarFile();
      update("avatar_url", "");
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not remove avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 500));

    const updates: Parameters<typeof updateProfile>[0] = {
      full_name: form.full_name,
      username: form.username,
      avatar_color: form.avatar_color,
      avatar_url: form.avatar_url,
    };

    if (user && isCreatorProfile(user)) {
      Object.assign(updates, {
        bio: form.bio,
        category: form.category,
        instagram_url: sanitizeSocialUrl(form.instagram_url),
        tiktok_url: sanitizeSocialUrl(form.tiktok_url),
        x_url: sanitizeSocialUrl(form.x_url),
      });
    }

    updateProfile(updates);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleDeleteAccount() {
    deleteAccount();
    router.push("/");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary-light" />
      </div>
    );
  }

  if (!user) return null;

  const isCreator = isCreatorProfile(user);

  return (
    <div className="px-4 md:px-8 py-3 max-w-3xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-serif font-normal text-brand-ink">Settings</h1>
        <p className="text-brand-ink-subtle mt-1">Manage your account and preferences.</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-brand-border">
        {(["account", ...(!isCreator ? (["billing"] as Tab[]) : [])] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors",
              activeTab === tab
                ? "border-brand-primary text-brand-primary-light"
                : "border-transparent text-brand-ink-muted hover:text-brand-ink-subtle"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ══ ACCOUNT TAB ══════════════════════════════════════════════ */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Avatar + color selector */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
            <h2 className="text-base font-semibold text-brand-ink mb-4">Avatar</h2>
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar
                  initials={user.avatar_initials}
                  color={form.avatar_color || user.avatar_color}
                  size="xl"
                  imageUrl={form.avatar_url ? `/api/public/avatar/${user.id}?v=${avatarVersion}` : undefined}
                />
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-primary border-2 border-brand-surface flex items-center justify-center cursor-pointer hover:bg-brand-primary-hover transition-colors">
                  <Camera className="w-3.5 h-3.5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleAvatarSelected(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm text-brand-ink-subtle mb-1">
                  {uploadingAvatar ? "Uploading photo..." : form.avatar_url ? "Photo uploaded" : "Upload a photo or choose a color"}
                </p>
                {form.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void handleAvatarRemoved()}
                    className="text-xs text-red-600 hover:text-red-700 mb-2 block"
                    disabled={uploadingAvatar}
                  >
                    Remove photo
                  </button>
                )}
                {avatarError && (
                  <p className="text-xs text-red-400 mb-2">{avatarError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => update("avatar_color", color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color,
                        form.avatar_color === color
                          ? "ring-2 ring-white ring-offset-2 ring-offset-brand-surface scale-110"
                          : "hover:scale-105"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Profile fields */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 space-y-4">
            <h2 className="text-base font-semibold text-brand-ink">Profile</h2>

            <Input
              label="Full Name"
              type="text"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              icon={<User className="w-4 h-4" />}
            />

            <div>
              <label className="text-sm font-medium text-brand-ink-subtle mb-1.5 block">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-muted text-sm pointer-events-none">@</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value.replace(/\s+/g, "").toLowerCase())}
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-brand-border bg-brand-elevated text-sm text-brand-ink focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>
            </div>

            {/* Email — read-only in mock */}
            <div>
              <label className="text-sm font-medium text-brand-ink-subtle mb-1.5 flex items-center gap-2 block">
                <Mail className="w-4 h-4" />
                Email
                <Badge variant="default" className="text-[10px] ml-1">Read-only</Badge>
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full h-10 px-3 rounded-xl border border-brand-border bg-brand-elevated/50 text-sm text-brand-ink-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Creator-only fields */}
          {isCreator && (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-brand-ink">Creator Profile</h2>
                <Badge variant="gold">Creator</Badge>
              </div>

              <div>
                <label className="text-sm font-medium text-brand-ink-subtle mb-1.5 block">
                  Bio
                  <span className="float-right text-xs font-normal text-brand-ink-muted">{(form.bio ?? "").length}/280</span>
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value.slice(0, 280))}
                  rows={3}
                  className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-muted resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-brand-ink-subtle mb-2 block">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => update("category", cat)}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all",
                        form.category === cat
                          ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light"
                          : "bg-brand-elevated border-brand-border text-brand-ink-subtle hover:border-brand-primary/40 hover:text-brand-ink"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Instagram"
                  type="url"
                  placeholder="https://instagram.com/yourhandle"
                  value={form.instagram_url}
                  onChange={(e) => update("instagram_url", e.target.value)}
                  icon={<Instagram className="w-4 h-4" />}
                />
                <Input
                  label="TikTok"
                  type="url"
                  placeholder="https://tiktok.com/@yourhandle"
                  value={form.tiktok_url}
                  onChange={(e) => update("tiktok_url", e.target.value)}
                  icon={<Music2 className="w-4 h-4" />}
                />
              </div>

              <Input
                label="X"
                type="url"
                placeholder="https://x.com/yourhandle"
                value={form.x_url}
                onChange={(e) => update("x_url", e.target.value)}
              />
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-brand-live" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
            {saved && (
              <p className="text-sm text-brand-live animate-fade-in">
                Changes saved and reflected in your sidebar.
              </p>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
            </div>
            <p className="text-xs text-brand-ink-muted mb-4">
              Deleting your account clears all local data and signs you out. This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </div>
      )}

      {/* ══ BILLING TAB ══════════════════════════════════════════════ */}
      {!isCreator && activeTab === "billing" && (
        <div className="space-y-6">
          {/* Payment method */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
            <h2 className="text-base font-semibold text-brand-ink mb-4">Payment Method</h2>

            {/* Saved payment methods */}
            {billingError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                {billingError}
              </p>
            )}

            {savedPaymentMethods.length > 0 && !showAddCard && (
              <div className="space-y-3 mb-4">
                {savedPaymentMethods.map((paymentMethod, index) => (
                  <div
                    key={paymentMethod.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-brand-elevated border border-brand-primary/30"
                  >
                    <CreditCard className="w-5 h-5 text-brand-primary-light shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-ink capitalize">
                        {paymentMethod.brand} ending in {paymentMethod.last4}
                      </p>
                      <p className="text-xs text-brand-ink-subtle">
                        Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {index === 0 && <Badge variant="live" className="text-[10px]">Saved</Badge>}
                      <button
                        onClick={() => handleRemoveCard(paymentMethod.id)}
                        disabled={removingPaymentMethodId === paymentMethod.id}
                        className="ml-2 text-brand-ink-muted hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                        title="Remove card"
                      >
                        {removingPaymentMethodId === paymentMethod.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {savedPaymentMethods.length === 0 && !showAddCard && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-elevated border border-brand-border mb-4">
                <CreditCard className="w-5 h-5 text-brand-ink-subtle" />
                <span className="text-sm text-brand-ink-subtle flex-1">
                  {loadingPaymentMethods ? "Loading payment methods..." : "No payment method on file"}
                </span>
              </div>
            )}

            {/* Add card form */}
            {showAddCard && setupClientSecret && (
              <div className="mb-4 p-4 rounded-xl border border-brand-border bg-brand-elevated">
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret: setupClientSecret, appearance: STRIPE_APPEARANCE }}
                >
                  <AddCardForm
                    onSuccess={handleCardSaved}
                    onCancel={() => { setShowAddCard(false); setSetupClientSecret(null); }}
                  />
                </Elements>
              </div>
            )}

            {!showAddCard && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleAddCard}
                disabled={loadingSetup}
              >
                {loadingSetup ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                ) : (
                  <><CreditCard className="w-4 h-4" />{savedPaymentMethods.length > 0 ? "Add Another Card" : "Add Payment Method"}</>
                )}
              </Button>
            )}
          </div>

          {/* Creator earnings — only shown to creators */}
          {isCreator && (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-brand-ink">Earnings Summary</h2>
                {loadingFinancials && <Loader2 className="w-4 h-4 animate-spin text-brand-ink-subtle" />}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { label: "Available to Withdraw", value: formatCurrency(earnings.available), accent: "text-gradient-gold" },
                  { label: "Pending Payout", value: formatCurrency(earnings.pending), accent: "text-brand-live" },
                  { label: "This Month", value: formatCurrency(earnings.thisMonth), accent: "text-brand-ink" },
                  { label: "Total Earned", value: formatCurrency(earnings.totalEarned), accent: "text-brand-primary-light" },
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-xl bg-brand-elevated border border-brand-border">
                    <p className={cn("text-xl font-display font-bold", s.accent)}>{s.value}</p>
                    <p className="text-[11px] text-brand-ink-muted mt-1 uppercase tracking-wider font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between mt-4 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-brand-primary-light" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-brand-ink">Withdraw Funds</h3>
                    <p className="text-xs text-brand-ink-muted mt-0.5">Transfer your available balance to your connected account</p>
                  </div>
                </div>
                <Button 
                  variant="gold" 
                  size="sm"
                  onClick={handleWithdraw}
                  disabled={earnings.available <= 0 || isWithdrawing || loadingFinancials}
                >
                  {isWithdrawing ? "Processing..." : "Withdraw"}
                </Button>
              </div>
            </div>
          )}

          {/* Payout history */}
          {isCreator && (
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
              <h2 className="text-base font-semibold text-brand-ink mb-4">Payout History</h2>
              
              {loadingFinancials ? (
                <div className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-ink-muted mx-auto" />
                </div>
              ) : payouts.length > 0 ? (
                <div className="space-y-3">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-brand-elevated border border-brand-border">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-brand-ink-subtle" />
                        <div>
                          <p className="text-sm font-semibold text-brand-ink">Withdrawal to Stripe</p>
                          <p className="text-[10px] text-brand-ink-muted">
                            {new Date(p.created_at).toLocaleDateString()} at {new Date(p.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-ink">{formatCurrency(p.amount)}</p>
                        <Badge variant={p.status === "completed" ? "live" : p.status === "failed" ? "danger" : "default"} className="text-[10px] mt-1 capitalize">
                          {p.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-8 h-8 text-brand-ink-muted mx-auto mb-3" />
                  <p className="text-brand-ink-muted text-sm">No payouts yet.</p>
                  <p className="text-brand-ink-muted text-xs mt-1">
                    When you withdraw your earnings, they will appear here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
