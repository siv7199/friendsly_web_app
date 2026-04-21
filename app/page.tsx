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
    <main className="min-h-screen bg-[#0f0f18] flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Blurred Discover page background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute inset-0" style={{ filter: "blur(18px) brightness(0.45)", transform: "scale(1.04)" }}>
          {/* Top search bar hint */}
          <div className="mx-6 mt-6 h-10 rounded-2xl bg-white/5 border border-white/8" />
          {/* Category pills */}
          <div className="flex gap-2 mx-6 mt-3">
            {["All", "Fitness", "Business", "Finance", "Beauty", "Tech", "Music"].map((c, i) => (
              <div key={c} className={`h-7 rounded-full px-3 shrink-0 text-xs flex items-center font-medium ${i === 0 ? "bg-violet-600 text-white" : "bg-white/8 text-white/50"}`}>{c}</div>
            ))}
          </div>
          {/* Creator cards grid */}
          <div className="grid grid-cols-3 gap-3 mx-6 mt-4">
            {[
              { initials: "MK", color: "bg-violet-700", name: "Maya K.", cat: "Fitness & Wellness", live: true, rating: "4.9" },
              { initials: "JR", color: "bg-indigo-600", name: "Jordan R.", cat: "Business & Startups", live: false, rating: "4.8" },
              { initials: "AL", color: "bg-purple-700", name: "Aria L.", cat: "Beauty & Skincare", live: true, rating: "5.0" },
              { initials: "DS", color: "bg-violet-800", name: "Dev S.", cat: "Tech & Career", live: false, rating: "4.7" },
              { initials: "NW", color: "bg-indigo-700", name: "Nia W.", cat: "Finance", live: false, rating: "4.9" },
              { initials: "CM", color: "bg-purple-600", name: "Cass M.", cat: "Music & Arts", live: true, rating: "4.8" },
              { initials: "TK", color: "bg-violet-600", name: "Theo K.", cat: "Gaming", live: false, rating: "4.6" },
              { initials: "RJ", color: "bg-indigo-800", name: "Rena J.", cat: "Content Creation", live: false, rating: "4.9" },
              { initials: "PL", color: "bg-purple-800", name: "Pierce L.", cat: "Business", live: true, rating: "5.0" },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden">
                <div className={`${c.color} h-16 flex items-center justify-center relative`}>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">{c.initials}</div>
                  {c.live && <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">LIVE</div>}
                </div>
                <div className="p-2">
                  <div className="text-white text-xs font-semibold truncate">{c.name}</div>
                  <div className="text-white/40 text-[10px] truncate">{c.cat}</div>
                  <div className="text-yellow-400 text-[10px] mt-1">★ {c.rating}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f18]/60 via-[#0f0f18]/50 to-[#0f0f18]/70" />
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
              <p className="text-xs leading-relaxed text-brand-ink-subtle">
                Password must be at least 8 characters and include an uppercase letter and a special character.
              </p>

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
