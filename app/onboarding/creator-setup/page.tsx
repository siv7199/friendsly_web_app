"use client";

/**
 * Creator Setup  (route: /onboarding/creator-setup)
 *
 * 2-step form → /dashboard
 *
 * Step 1: Name + Username
 * Step 2: Bio + Category  (NO pricing — creators set rates in /management)
 * Step 3: Review + Launch
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, ChevronRight, ChevronLeft,
  CheckCircle2, Sparkles, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { CREATOR_CATEGORIES, saveRegisteredCreator } from "@/lib/mock-auth";
import { isCreatorProfile } from "@/types";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

interface FormData {
  full_name: string;
  username: string;
  bio: string;
  category: string;
}

const MAX_BIO = 280;

const STEPS = [
  { n: 1, label: "Identity" },
  { n: 2, label: "Profile" },
  { n: 3, label: "Review" },
] as const;

export default function CreatorSetupPage() {
  const router = useRouter();
  const { user, updateProfile } = useAuthContext();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormData>({
    full_name: user?.full_name ?? "",
    username: user?.username ?? "",
    bio: "",
    category: CREATOR_CATEGORIES[0],
  });

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canAdvance: Record<Step, boolean> = {
    1: form.full_name.trim().length > 0 && form.username.trim().length > 0,
    2: form.bio.trim().length > 0 && !!form.category,
    3: true,
  };

  async function handleSubmit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    // Save to auth profile
    updateProfile({
      full_name: form.full_name,
      username: form.username,
      bio: form.bio,
      hourly_rate: 0,        // Set later in /management when creating packages
      category: form.category,
      is_live: false,
    } as Parameters<typeof updateProfile>[0]);

    // ── Register on the discover page ────────────────────────────────
    // Build a temporary up-to-date profile snapshot since updateProfile
    // is async in React state — we construct the merged object directly.
    if (user) {
      const updatedProfile = {
        ...user,
        full_name: form.full_name,
        username: form.username,
        bio: form.bio,
        hourly_rate: 0,
        category: form.category,
        is_live: false,
        role: "creator" as const,
      };
      if (isCreatorProfile(updatedProfile)) {
        saveRegisteredCreator(updatedProfile);
      }
    }

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
            <div className="space-y-4">
              <div className="text-center mb-2">
                <Avatar
                  initials={user?.avatar_initials ?? "?"}
                  color={user?.avatar_color ?? "bg-violet-600"}
                  size="lg"
                  className="mx-auto mb-2"
                />
                <p className="text-xs text-slate-500">Avatar is auto-generated from your name</p>
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
                    initials={user?.avatar_initials ?? "?"}
                    color={user?.avatar_color ?? "bg-violet-600"}
                    size="md"
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
