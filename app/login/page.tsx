"use client";

import Link from "next/link";
import { useState, useEffect, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

function sanitizeNextPath(nextPath: string | null, role?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) return null;

  const creatorOnlyPrefixes = ["/dashboard", "/management", "/calendar", "/live", "/earnings", "/m/live"];
  const fanOnlyPrefixes = ["/discover", "/profile", "/bookings", "/payments", "/saved", "/m/waiting-room"];
  const matchesPrefix = (prefixes: string[]) => prefixes.some((prefix) => nextPath === prefix || nextPath.startsWith(`${prefix}/`));

  if (role === "fan" && matchesPrefix(creatorOnlyPrefixes)) return null;
  if (role === "creator" && matchesPrefix(fanOnlyPrefixes)) return null;

  return nextPath;
}

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
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [emailConfirmedMessage, setEmailConfirmedMessage] = useState(false);
  const signInEmailRef = useRef<HTMLInputElement | null>(null);
  const signInPasswordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role) {
      const safeNext = sanitizeNextPath(next, user.role);
      router.replace(user.role === "creator" ? "/dashboard" : (safeNext || "/discover"));
    }
  }, [isAuthenticated, user, isLoading, next, router]);

  useEffect(() => {
    if (!isLoading && user && !user.role) {
      router.replace(next ? `/onboarding/fan-setup?next=${encodeURIComponent(next)}` : "/onboarding/fan-setup");
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
    setEmailConfirmedMessage(params.get("emailConfirmed") === "1");
  }, []);

  useEffect(() => {
    if (tab !== "signin") return;

    const syncAutofilledValues = () => {
      const emailValue = signInEmailRef.current?.value ?? "";
      const passwordValue = signInPasswordRef.current?.value ?? "";

      if (emailValue && emailValue !== siEmail) setSiEmail(emailValue);
      if (passwordValue && passwordValue !== siPassword) setSiPassword(passwordValue);
    };

    const frameId = window.requestAnimationFrame(syncAutofilledValues);
    const timeoutId = window.setTimeout(syncAutofilledValues, 250);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [tab, siEmail, siPassword]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    const email = signInEmailRef.current?.value?.trim() || siEmail.trim();
    const password = signInPasswordRef.current?.value || siPassword;

    if (!email || !password) return;

    if (email !== siEmail) setSiEmail(email);
    if (password !== siPassword) setSiPassword(password);

    const result = await login(email, password);
    if (!result.success || !result.user) return;

    const safeNext = sanitizeNextPath(next, result.user.role);

    let destination: string;
    if (result.user.role === "creator") {
      destination = "/dashboard";
    } else if (result.user.role === "fan") {
      destination = safeNext || "/discover";
    } else {
      // No role — check if there's an approved creator request
      try {
        const res = await fetch("/api/auth/resolve-role", { method: "POST" });
        const data = await res.json();
        if (data?.role === "creator" && data?.promoted) {
          destination = "/dashboard";
        } else {
          destination = safeNext
            ? `/onboarding/fan-setup?next=${encodeURIComponent(safeNext)}`
            : "/onboarding/fan-setup";
        }
      } catch {
        destination = safeNext
          ? `/onboarding/fan-setup?next=${encodeURIComponent(safeNext)}`
          : "/onboarding/fan-setup";
      }
    }

    window.location.replace(destination);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    const result = await signup(suEmail, suPassword, suName, next);
    if (result.requiresEmailConfirmation) {
      setShowEmailConfirmationModal(true);
      setTab("signin");
      setSiEmail(suEmail.trim().toLowerCase());
      setSuPassword("");
      return;
    }
    if (result.signedIn) {
      router.push(next ? `/onboarding/fan-setup?next=${encodeURIComponent(next)}` : "/onboarding/fan-setup");
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
    <main
      className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-hidden bg-[#0f0f18] px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2.25rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <img
          src="/fan_dashboard.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ filter: "blur(6px)", transform: "scale(1.04)" }}
        />
        <div className="absolute inset-0 bg-[#0c0c18]/65" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up sm:my-auto">
        <div className="overflow-hidden rounded-[28px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,246,255,0.96))] px-4 py-4 shadow-[0_28px_90px_rgba(12,12,24,0.22)] backdrop-blur-sm md:px-5 md:py-5">
          <div className="mx-auto w-full">
            <div className="mb-4 text-center animate-fade-in">
              <div className="flex flex-col items-center gap-2 rounded-[20px] border border-[rgba(133,117,201,0.18)] bg-[rgba(248,246,255,0.9)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <BrandLogo href="/" size="sm" theme="light" />
                <p className="max-w-[28ch] text-xs leading-5 text-brand-ink-muted">
                  Real 1-on-1 connections with the creators you love.
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-[rgba(133,117,201,0.18)] bg-white px-3 py-3 shadow-[0_18px_50px_rgba(55,33,110,0.12)] md:px-4 md:py-4">
              <div className="mb-4 flex rounded-[16px] border border-brand-border bg-brand-surface p-1 shadow-sm">
                {(["signin", "signup"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex-1 rounded-[13px] py-2 text-sm font-semibold transition-all duration-150",
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
                <form onSubmit={handleSignIn} className="space-y-3 px-1 pb-1">
                  {emailConfirmedMessage ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Your Friendsly email is confirmed. Sign in to continue.
                    </p>
                  ) : null}
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    onInput={(e) => setSiEmail((e.target as HTMLInputElement).value)}
                    icon={<Mail className="w-4 h-4" />}
                    required
                    autoComplete="email"
                    ref={signInEmailRef}
                  />
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      onInput={(e) => setSiPassword((e.target as HTMLInputElement).value)}
                      icon={<Lock className="w-4 h-4" />}
                      required
                      autoComplete="current-password"
                      className="pr-14"
                      ref={signInPasswordRef}
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

                  <Button type="submit" variant="primary" size="sm" className="w-full" disabled={isLoading || !(siEmail.trim() || signInEmailRef.current?.value?.trim()) || !(siPassword || signInPasswordRef.current?.value)}>
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
                  </Button>
                </form>
              )}

              {tab === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-3 px-1 pb-1">
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
                    size="sm"
                    className="w-full"
                    disabled={isLoading || !suName || !suEmail || !suPassword || !agreedToTerms || !confirmedAge}
                  >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Fan Account"}
                  </Button>

                  <Link href="/onboarding/creator-request" className="block">
                    <Button type="button" variant="outline" size="sm" className="w-full">
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

      <Dialog open={showEmailConfirmationModal} onClose={() => setShowEmailConfirmationModal(false)}>
        <DialogContent
          title="Check your email"
          description="We sent your Friendsly confirmation email. Press the link in that email to confirm your account, then come right back here to sign in."
          onClose={() => setShowEmailConfirmationModal(false)}
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <BrandLogo href="/" size="sm" theme="light" />
            </div>
            <div className="rounded-2xl border border-brand-border bg-brand-surface px-4 py-4">
              <p className="text-sm font-semibold text-brand-ink">Next step</p>
              <p className="mt-1 text-sm leading-6 text-brand-ink-muted">
                Go to <span className="font-semibold text-brand-ink">{suEmail.trim().toLowerCase()}</span>, open the Friendsly email, and press the link to confirm your email.
              </p>
            </div>
            <p className="text-sm leading-6 text-brand-ink-muted">
              After you confirm your account, Friendsly will send you back to the sign-in page so you can log in normally.
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setShowEmailConfirmationModal(false)}
            >
              I&apos;ll check my email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
