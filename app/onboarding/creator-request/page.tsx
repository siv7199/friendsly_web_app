"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, Sparkles, User, CheckCircle2, Link2, Lock, Instagram, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function CreatorRequestPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    instagramUrl: "",
    tiktokUrl: "",
    xUrl: "",
    notes: "",
  });

  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "creator") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!user) {
        if (!form.password || form.password.length < 8) {
          throw new Error("Please create a password with at least 8 characters.");
        }

        if (form.password !== form.confirmPassword) {
          throw new Error("Password confirmation does not match.");
        }

        const supabase = createClient();
        const { data, error: signupError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              full_name: form.fullName.trim(),
            },
          },
        });

        if (signupError) {
          throw new Error(signupError.message);
        }

        if (data.user && !data.session) {
          throw new Error("Email confirmation is required before we can save this creator request.");
        }
      }

      const response = await fetch("/api/creator-signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          instagramUrl: form.instagramUrl,
          tiktokUrl: form.tiktokUrl,
          xUrl: form.xUrl,
          notes: form.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not submit creator request.");
      }

      if (!user) {
        await logout();
      }

      setSubmitted(true);
      setEmailConfigured(Boolean(data.emailNotificationConfigured));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit creator request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[8%] h-[420px] w-[420px] rounded-full bg-brand-gold opacity-10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[8%] h-[360px] w-[360px] rounded-full bg-brand-primary opacity-10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 rounded-full border border-brand-border bg-brand-surface px-4 py-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-xs font-medium text-brand-ink-subtle">Creator access is manually approved</span>
          </div>
          <h1 className="text-3xl font-serif font-normal text-brand-ink">Apply for a creator account</h1>
          <p className="mt-2 text-sm text-brand-ink-subtle">
            Share your contact info and any socials you want us to review. Social links are optional.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 md:p-7">
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-live/15 text-brand-live">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-brand-ink">Request received</h2>
                <p className="mt-2 text-sm leading-6 text-brand-ink-subtle">
                  We saved your creator application. You will not be able to sign in until the request is approved.
                </p>
                {emailConfigured === false && (
                  <p className="mt-3 text-xs text-amber-300">
                    Email notifications are not configured yet, so this request was stored without sending an email alert.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                placeholder="Jordan Kim"
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />
              {!user && (
                <>
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={form.password}
                      onChange={(event) => update("password", event.target.value)}
                      icon={<Lock className="w-4 h-4" />}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-[34px] text-xs font-semibold text-brand-ink-subtle hover:text-brand-ink transition-colors"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    label="Confirm Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={(event) => update("confirmPassword", event.target.value)}
                    icon={<Lock className="w-4 h-4" />}
                    required
                    autoComplete="new-password"
                  />
                </>
              )}
              <Input
                label="Phone Number"
                type="tel"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                icon={<Phone className="w-4 h-4" />}
                required
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Instagram (Optional)"
                  type="url"
                  placeholder="https://instagram.com/yourhandle"
                  value={form.instagramUrl}
                  onChange={(event) => update("instagramUrl", event.target.value)}
                  icon={<Instagram className="w-4 h-4" />}
                />
                <Input
                  label="TikTok (Optional)"
                  type="url"
                  placeholder="https://tiktok.com/@yourhandle"
                  value={form.tiktokUrl}
                  onChange={(event) => update("tiktokUrl", event.target.value)}
                  icon={<Music2 className="w-4 h-4" />}
                />
              </div>
              <Input
                label="X (Optional)"
                type="url"
                placeholder="https://x.com/yourhandle"
                value={form.xUrl}
                onChange={(event) => update("xUrl", event.target.value)}
                icon={<Link2 className="w-4 h-4" />}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brand-ink-subtle" htmlFor="creator-request-notes">
                  Notes
                </label>
                <textarea
                  id="creator-request-notes"
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Anything you want the review team to know"
                  rows={4}
                  className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3 text-xs leading-5 text-brand-ink-subtle">
                {user
                  ? "Manual review keeps creator accounts vetted before they can accept bookings or go live."
                  : "You will set your password now, but sign-in stays locked until the review team approves your creator request."}
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full"
                disabled={
                  submitting ||
                  !form.fullName ||
                  !form.email ||
                  !form.phone
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting request...
                  </>
                ) : (
                  "Request Creator Access"
                )}
              </Button>

              <p className="text-center text-xs text-brand-ink-muted">
                Fan accounts still use the regular sign-up flow. Creator accounts are approved manually.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
