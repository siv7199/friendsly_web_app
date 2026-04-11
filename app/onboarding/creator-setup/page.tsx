"use client";

/**
 * Creator Setup  (route: /onboarding/creator-setup)
 *
 * Step 1: Name + Username + Avatar color
 * Step 2: Bio + Category
 * Step 3: Review + Launch
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, ChevronRight, ChevronLeft,
  CheckCircle2, Sparkles, Loader2, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { CREATOR_CATEGORIES } from "@/lib/mock-auth";
import { cn } from "@/lib/utils";
import { removeAvatarFile, uploadAvatarFile } from "@/lib/avatar-upload";

type Step = 1 | 2 | 3;

interface FormData {
  full_name: string;
  username: string;
  bio: string;
  category: string;
  avatar_color: string;
  avatar_url?: string;
}

const MAX_BIO = 280;

const AVATAR_COLORS = [
  { cls: "bg-violet-600",  hex: "#7c3aed" },
  { cls: "bg-purple-600",  hex: "#9333ea" },
  { cls: "bg-indigo-600",  hex: "#4f46e5" },
  { cls: "bg-blue-600",    hex: "#2563eb" },
  { cls: "bg-cyan-600",    hex: "#0891b2" },
  { cls: "bg-teal-600",    hex: "#0d9488" },
  { cls: "bg-green-600",   hex: "#16a34a" },
  { cls: "bg-amber-500",   hex: "#f59e0b" },
  { cls: "bg-orange-500",  hex: "#f97316" },
  { cls: "bg-rose-600",    hex: "#e11d48" },
  { cls: "bg-pink-600",    hex: "#db2777" },
  { cls: "bg-red-600",     hex: "#dc2626" },
];

const STEPS = [
  { n: 1, label: "Identity" },
  { n: 2, label: "Profile" },
  { n: 3, label: "Review" },
] as const;

export default function CreatorSetupPage() {
  const router = useRouter();
  const { user, updateProfile, isLoading } = useAuthContext();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [form, setForm] = useState<FormData>({
    full_name: user?.full_name ?? "",
    username: user?.username ?? "",
    bio: "",
    category: CREATOR_CATEGORIES[0],
    avatar_color: user?.avatar_color ?? "bg-violet-600",
    avatar_url: user?.avatar_url ?? "",
  });

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/");
      return;
    }

    if (user.role !== "creator") {
      router.replace("/onboarding/creator-request");
    }
  }, [user, isLoading, router]);

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAvatarSelected(file?: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const avatarUrl = await uploadAvatarFile(file);
      update("avatar_url", avatarUrl);
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

  const canAdvance: Record<Step, boolean> = {
    1: form.full_name.trim().length > 0 && form.username.trim().length > 0,
    2: form.bio.trim().length > 0 && !!form.category,
    3: true,
  };

  // Derive initials from current full_name input
  const initials = form.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  async function handleSubmit() {
    setSubmitting(true);
    await (updateProfile as (u: Parameters<typeof updateProfile>[0]) => Promise<void>)({
      full_name: form.full_name,
      username: form.username,
      avatar_color: form.avatar_color,
      avatar_url: form.avatar_url,
      bio: form.bio,
      category: form.category,
      is_live: false,
    });
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-brand-gold opacity-6 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-xs text-slate-400 font-medium">Creator Setup — Step {step} of 3</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Set up your creator profile</h1>
          <p className="text-slate-500 text-sm mt-1">You&apos;ll set your call prices in your dashboard after signup.</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map(({ n, label }) => (
            <div key={n} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                "h-1.5 w-full rounded-full transition-all duration-500",
                n < step ? "bg-brand-gold" : n === step ? "bg-brand-primary" : "bg-brand-border"
              )} />
              <span className={cn("text-[10px] font-medium", n === step ? "text-slate-300" : "text-slate-600")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6">

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Avatar preview + color picker */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar
                    initials={initials}
                    color={form.avatar_color}
                    size="lg"
                    imageUrl={form.avatar_url || undefined}
                  />
                  <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-primary border-2 border-brand-surface flex items-center justify-center cursor-pointer hover:bg-brand-primary-hover transition-colors">
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
                {form.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void handleAvatarRemoved()}
                    className="text-xs text-red-400 hover:text-red-300 -mt-1"
                    disabled={uploadingAvatar}
                  >
                    Remove photo
                  </button>
                )}
                {avatarError && (
                  <p className="text-xs text-red-400 -mt-1">{avatarError}</p>
                )}
                {uploadingAvatar && (
                  <p className="text-xs text-slate-400 -mt-1">Uploading photo...</p>
                )}
                <p className="text-xs text-slate-500">Pick a background color</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_COLORS.map(({ cls, hex }) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => update("avatar_color", cls)}
                      style={{ backgroundColor: hex }}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all",
                        form.avatar_color === cls
                          ? "ring-2 ring-white ring-offset-2 ring-offset-brand-elevated scale-110"
                          : "hover:scale-105"
                      )}
                      aria-label={cls}
                    />
                  ))}
                </div>
              </div>

              <Input
                label="Full Name"
                type="text"
                placeholder="Luna Vasquez"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                icon={<User className="w-4 h-4" />}
              />

              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">@</span>
                  <input
                    type="text"
                    placeholder="lunavfit"
                    value={form.username}
                    onChange={(e) => update("username", e.target.value.replace(/\s+/g, "").toLowerCase())}
                    className="w-full h-10 pl-7 pr-3 rounded-xl border border-brand-border bg-brand-elevated text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Bio + Category ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                  Bio
                  <span className="ml-auto float-right text-xs text-slate-500 font-normal">
                    {form.bio.length}/{MAX_BIO}
                  </span>
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value.slice(0, MAX_BIO))}
                  placeholder="Tell fans what you do and what they'll get from a call with you..."
                  rows={4}
                  className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Category</label>
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
                          : "bg-brand-elevated border-brand-border text-slate-400 hover:border-brand-primary/40 hover:text-slate-200"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-brand-gold/5 border border-brand-gold/20 text-xs text-slate-400 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                <span>You&apos;ll set your call prices in <strong className="text-slate-300">Manage Offerings</strong> after your profile is live.</span>
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Here&apos;s how your profile will look on the discover page:</p>

              <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    initials={initials}
                    color={form.avatar_color}
                    size="md"
                    imageUrl={form.avatar_url || undefined}
                  />
                  <div>
                    <p className="font-bold text-slate-100">{form.full_name}</p>
                    <p className="text-sm text-slate-500">@{form.username}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary-light">
                  {form.category}
                </span>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed line-clamp-3">{form.bio}</p>
                <div className="mt-3 pt-3 border-t border-brand-border">
                  <span className="text-xs text-slate-500">💡 Set call prices in Manage Offerings after launching</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {[
                  `Name: ${form.full_name}`,
                  `Username: @${form.username}`,
                  `Category: ${form.category}`,
                  "Pricing: Set up in Manage Offerings",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-live shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" size="md" className="flex-1" onClick={() => setStep((s) => (s - 1) as Step)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            {step < 3 ? (
              <Button variant="primary" size="md" className="flex-1" disabled={!canAdvance[step]} onClick={() => setStep((s) => (s + 1) as Step)}>
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="gold" size="md" className="flex-1" disabled={submitting} onClick={handleSubmit}>
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching...</>
                  : <><Sparkles className="w-4 h-4" /> Launch My Profile</>
                }
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
