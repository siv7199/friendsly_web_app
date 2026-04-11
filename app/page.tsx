"use client";

/**
 * Entry Page  (route: "/")
 *
 * This IS the login/signup page — no separate landing page.
 * Two tabs: "Sign In" and "Create Account".
 *
 * After Sign In  → redirect to /discover (fan) or /dashboard (creator)
 * After Sign Up  → redirect to /onboarding/role
 *
 * Authenticated users are bounced straight to their home before the
 * page renders (via the useEffect below).
 */

import Link from "next/link";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, User, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, user, isLoading, error } = useAuthContext();

  const [tab, setTab] = useState<Tab>("signin");
  const [showPassword, setShowPassword] = useState(false);

  // Sign-in form
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Create account form
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  // Redirect already-authenticated users immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role) {
      router.replace(user.role === "creator" ? "/dashboard" : "/discover");
    }
  }, [isAuthenticated, user, isLoading, router]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    await login(siEmail, siPassword);
    // Redirect is handled by the useEffect above that watches isAuthenticated + user.role
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    await signup(suEmail, suPassword, suName);
    router.push("/onboarding/role");
  }

  return (
    <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[15%] w-[500px] h-[500px] rounded-full bg-brand-primary opacity-10 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-900 opacity-10 blur-[100px]" />
      </div>

      {/* Logo + tagline */}
      <div className="relative z-10 text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-3xl font-black text-white">Friendsly</span>
        </div>
        <p className="text-slate-500 text-sm mt-2">Real 1-on-1 connections with the creators you love.</p>
      </div>

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Tab switcher */}
        <div className="flex mb-1 p-1 bg-brand-surface rounded-2xl border border-brand-border">
          <button
            onClick={() => setTab("signin")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
              tab === "signin"
                ? "bg-brand-elevated text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab("signup")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
              tab === "signup"
                ? "bg-brand-elevated text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            Sign Up
          </button>
        </div>

        {/* Card body */}
        <div className="glass-card rounded-2xl p-6 space-y-4">

          {/* ── SIGN IN ── */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[34px] text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading || !siEmail || !siPassword}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
              </Button>

            </form>
          )}

          {/* ── CREATE ACCOUNT ── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[34px] text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading || !suName || !suEmail || !suPassword}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating fan account...</> : "Create Fan Account"}
              </Button>

              <Link href="/onboarding/creator-request" className="block">
                <Button type="button" variant="outline" size="lg" className="w-full">
                  Apply as Creator Instead
                </Button>
              </Link>

              <p className="text-center text-[11px] text-slate-600">
                By signing up you agree to our Terms of Service and Privacy Policy. Creator accounts are reviewed manually before access is enabled.
              </p>
            </form>
          )}
        </div>

      </div>
    </main>
  );
}
