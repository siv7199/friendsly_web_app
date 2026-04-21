"use client";

import Link from "next/link";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, user, isLoading, error } = useAuthContext();
  const [next, setNext] = useState<string | null>(null);
  const [requestedTab, setRequestedTab] = useState<Tab | null>(null);

  const [tab, setTab] = useState<Tab>("signin");
  const [showPassword, setShowPassword] = useState(false);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role) {
      router.replace(user.role === "creator" ? "/dashboard" : (next || "/discover"));
    }
  }, [isAuthenticated, user, isLoading, next, router]);

  useEffect(() => {
    if (!isLoading && user && !user.role) {
      router.replace(next ? `/onboarding/role?next=${encodeURIComponent(next)}` : "/onboarding/role");
    }
  }, [isLoading, user, next, router]);

  useEffect(() => {
    if (requestedTab === "signin" || requestedTab === "signup") setTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next"));
    const t = params.get("tab");
    setRequestedTab(t === "signup" ? "signup" : t === "signin" ? "signin" : null);
  }, []);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    await login(siEmail, siPassword);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    const result = await signup(suEmail, suPassword, suName, next);
    if (result.signedIn) {
      router.push(next ? `/onboarding/role?next=${encodeURIComponent(next)}` : "/onboarding/role");
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    setResetSending(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const supabase = createClient();
      const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;

      setResetSuccess("Check your email for a password reset link.");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetSending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0f0f18] px-4 py-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <img
          src="/fan_dashboard.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ filter: "blur(6px)", transform: "scale(1.04)" }}
        />
        <div className="absolute inset-0 bg-[#0c0c18]/65" />
      </div>

      <div className="relative z-10 w-full max-w-3xl animate-slide-up">
        <div className="overflow-hidden rounded-[36px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,246,255,0.96))] px-5 py-6 shadow-[0_28px_90px_rgba(12,12,24,0.22)] backdrop-blur-sm md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-8 text-center animate-fade-in">
              <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[rgba(133,117,201,0.18)] bg-[rgba(248,246,255,0.9)] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <BrandLogo href="/" size="md" theme="light" />
                <p className="max-w-[28ch] text-sm leading-6 text-brand-ink-muted md:text-base">
                  Real 1-on-1 connections with the creators you love.
                </p>
              </div>
            </div>

            <div className="rounded-[30px] border border-[rgba(133,117,201,0.18)] bg-white px-4 py-4 shadow-[0_18px_50px_rgba(55,33,110,0.12)] md:px-6 md:py-6">
              <div className="mb-5 flex rounded-[22px] border border-brand-border bg-brand-surface p-1 shadow-sm">
                {(["signin", "signup"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex-1 rounded-[18px] py-3 text-base font-semibold transition-all duration-150",
                      tab === t
                        ? "bg-[rgba(175,163,234,0.34)] text-brand-primary-deep shadow-sm"
                        : "text-brand-ink-muted hover:text-brand-ink"
                    )}
                  >
                    {t === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {tab === "signin" && (
                <form onSubmit={handleSignIn} className="space-y-4 px-2 pb-2">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
                    required
                    autoComplete="email"
                  />
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      icon={<Lock className="w-4 h-4" />}
                      required
                      autoComplete="current-password"
                      className="pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-[30px] flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:bg-brand-primary-bg hover:text-brand-primary-deep focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword((current) => !current);
                        setResetError(null);
                        setResetSuccess(null);
                        setResetEmail((current) => current || siEmail);
                      }}
                      className="text-sm font-semibold text-brand-primary transition-colors hover:text-brand-primary-deep hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {showForgotPassword ? (
                    <div className="rounded-2xl border border-brand-border bg-[rgba(248,246,255,0.88)] px-4 py-4">
                      <p className="text-sm font-semibold text-brand-ink">Reset your password</p>
                      <p className="mt-1 text-xs leading-5 text-brand-ink-subtle">
                        We&apos;ll email you a secure link to choose a new password.
                      </p>
                      <div className="mt-3 space-y-3">
                        <Input
                          label="Account Email"
                          type="email"
                          placeholder="you@example.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          icon={<Mail className="w-4 h-4" />}
                          required
                          autoComplete="email"
                        />
                        {resetError ? (
                          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {resetError}
                          </p>
                        ) : null}
                        {resetSuccess ? (
                          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                            {resetSuccess}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="w-full"
                          disabled={resetSending || !resetEmail.trim()}
                          onClick={() => void handleForgotPassword()}
                        >
                          {resetSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending reset link...</> : "Email reset link"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading || !siEmail || !siPassword}>
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
                  </Button>
                </form>
              )}

              {tab === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4 px-2 pb-2">
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Jordan Kim"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    icon={<User className="w-4 h-4" />}
                    required
                    autoComplete="name"
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
                    required
                    autoComplete="email"
                  />
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      icon={<Lock className="w-4 h-4" />}
                      required
                      autoComplete="new-password"
                      className="pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-[30px] flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:bg-brand-primary-bg hover:text-brand-primary-deep focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-ink-subtle">
                    Password must be at least 8 characters and include an uppercase letter and a special character.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-brand-border bg-brand-elevated px-3 py-3 text-xs leading-relaxed text-brand-ink-subtle">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(event) => setAgreedToTerms(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary/30"
                    />
                    <span>
                      I agree to the{" "}
                      <Link href="/terms" className="font-semibold text-brand-primary hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="font-semibold text-brand-primary hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-brand-border bg-brand-elevated px-3 py-3 text-xs leading-relaxed text-brand-ink-subtle">
                    <input
                      type="checkbox"
                      checked={confirmedAge}
                      onChange={(event) => setConfirmedAge(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary/30"
                    />
                    <span>I confirm that I am 18 years of age or older.</span>
                  </label>

                  {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isLoading || !suName || !suEmail || !suPassword || !agreedToTerms || !confirmedAge}
                  >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Fan Account"}
                  </Button>

                  <Link href="/onboarding/creator-request" className="block">
                    <Button type="button" variant="outline" size="lg" className="w-full">
                      Apply as Creator Instead
                    </Button>
                  </Link>

                  <p className="text-center text-[11px] leading-relaxed text-brand-ink-subtle">
                    By signing up you agree to our{" "}
                    <Link href="/terms" className="font-semibold text-brand-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-semibold text-brand-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                    Creator accounts are reviewed manually before access is enabled.
                  </p>
                  <p className="text-center text-xs text-brand-ink-subtle">
                    Need help?{" "}
                    <Link href="/support" className="font-semibold text-brand-primary hover:underline">
                      Contact support
                    </Link>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
