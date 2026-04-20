"use client";

import Link from "next/link";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
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

  return (
    <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-10%] left-[20%] w-[480px] h-[480px] rounded-full bg-brand-primary opacity-[0.07] blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[15%] w-[380px] h-[380px] rounded-full bg-brand-primary opacity-[0.05] blur-[90px]" />
      </div>

      {/* Logo + tagline */}
      <div className="relative z-10 text-center mb-8 animate-fade-in flex flex-col items-center gap-3">
        <BrandLogo href="/" size="md" theme="light" />
        <p className="text-brand-ink-muted text-sm mt-1">Real 1-on-1 connections with the creators you love.</p>
      </div>

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Tab switcher */}
        <div className="flex mb-1 p-1 bg-brand-surface rounded-2xl border border-brand-border shadow-sm">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-150",
                tab === t
                  ? "bg-brand-primary-bg text-brand-primary-deep shadow-sm"
                  : "text-brand-ink-muted hover:text-brand-ink"
              )}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Card body */}
        <div className="panel-card rounded-2xl p-6 space-y-4 shadow-md-light">

          {/* Sign In */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                label="Email" type="email" placeholder="you@example.com"
                value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />} required autoComplete="email"
              />
              <div className="relative">
                <Input
                  label="Password" type={showPassword ? "text" : "password"} placeholder="Your password"
                  value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />} required autoComplete="current-password" className="pr-14"
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

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading || !siEmail || !siPassword}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
              </Button>
            </form>
          )}

          {/* Sign Up */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <Input
                label="Full Name" type="text" placeholder="Jordan Kim"
                value={suName} onChange={(e) => setSuName(e.target.value)}
                icon={<User className="w-4 h-4" />} required autoComplete="name"
              />
              <Input
                label="Email" type="email" placeholder="you@example.com"
                value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />} required autoComplete="email"
              />
              <div className="relative">
                <Input
                  label="Password" type={showPassword ? "text" : "password"} placeholder="Create a password"
                  value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />} required autoComplete="new-password" className="pr-14"
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

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading || !suName || !suEmail || !suPassword}
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Fan Account"}
              </Button>

              <Link href="/onboarding/creator-request" className="block">
                <Button type="button" variant="outline" size="lg" className="w-full">
                  Apply as Creator Instead
                </Button>
              </Link>

              <p className="text-center text-[11px] text-brand-ink-subtle leading-relaxed">
                By signing up you agree to our Terms of Service and Privacy Policy.
                Creator accounts are reviewed manually before access is enabled.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
