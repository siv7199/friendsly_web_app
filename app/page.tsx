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
        {/* Discover page replica — blurred */}
        <div className="absolute inset-0 bg-[#10101a]" style={{ filter: "blur(8px)", transform: "scale(1.05)" }}>
          {/* Sidebar rail */}
          <div className="absolute left-0 top-0 bottom-0 w-[200px] bg-[#13131f] border-r border-white/[0.06] flex flex-col gap-3 px-4 pt-6">
            <div className="h-6 w-24 rounded-lg bg-violet-500/40" />
            <div className="mt-4 flex flex-col gap-2">
              {[70, 55, 55, 55, 55].map((w, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded bg-white/10" />
                  <div className={`h-3 rounded bg-white/${i === 0 ? "30" : "10"}`} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
          {/* Main content area */}
          <div className="absolute left-[200px] right-0 top-0 bottom-0 px-8 pt-6">
            {/* Page header */}
            <div className="flex items-center justify-between mb-5">
              <div className="h-7 w-36 rounded-xl bg-white/10" />
              <div className="h-9 w-64 rounded-xl bg-white/[0.07] border border-white/[0.08]" />
            </div>
            {/* Live now banner */}
            <div className="mb-5 h-24 rounded-2xl bg-gradient-to-r from-violet-900/70 via-purple-900/60 to-indigo-900/70 border border-violet-500/30 flex items-center px-6 gap-4">
              <div className="w-10 h-10 rounded-full bg-violet-500/60 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-32 rounded bg-white/40" />
                <div className="h-2.5 w-48 rounded bg-white/20" />
              </div>
              <div className="ml-auto flex gap-2">
                {["MK","AR","JT"].map((init, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${["bg-violet-600","bg-indigo-500","bg-purple-600"][i]}`}>{init}</div>
                ))}
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/60">+4</div>
              </div>
            </div>
            {/* Category pills */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {["All", "Fitness & Wellness", "Business", "Finance", "Beauty", "Tech & Career", "Music"].map((label, i) => (
                <div key={label} className={`h-8 rounded-full px-4 flex items-center text-xs font-medium ${i === 0 ? "bg-violet-600 text-white" : "bg-white/[0.07] text-white/50 border border-white/[0.08]"}`}>{label}</div>
              ))}
            </div>
            {/* Creator cards grid */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { initials: "MK", grad: "from-violet-700 to-purple-800", name: "Maya Kwan", cat: "Fitness & Wellness", live: true, rating: "4.9", reviews: "312" },
                { initials: "JR", grad: "from-indigo-600 to-blue-800", name: "Jordan Reed", cat: "Business & Startups", live: false, rating: "4.8", reviews: "198" },
                { initials: "AL", grad: "from-pink-600 to-purple-700", name: "Aria Langley", cat: "Beauty & Skincare", live: true, rating: "5.0", reviews: "547" },
                { initials: "DS", grad: "from-violet-800 to-indigo-900", name: "Dev Sharma", cat: "Tech & Career", live: false, rating: "4.7", reviews: "89" },
                { initials: "NW", grad: "from-emerald-700 to-teal-800", name: "Nia Walsh", cat: "Finance & Investing", live: false, rating: "4.9", reviews: "231" },
                { initials: "CM", grad: "from-purple-600 to-pink-700", name: "Cass Monroe", cat: "Music & Arts", live: true, rating: "4.8", reviews: "405" },
                { initials: "TK", grad: "from-blue-700 to-indigo-800", name: "Theo Kato", cat: "Gaming & Esports", live: false, rating: "4.6", reviews: "167" },
                { initials: "RJ", grad: "from-rose-700 to-pink-800", name: "Rena James", cat: "Content Creation", live: false, rating: "4.9", reviews: "289" },
              ].map((c, i) => (
                <div key={i} className="rounded-2xl bg-[#1a1a2e] border border-white/[0.07] overflow-hidden">
                  {/* Card header gradient */}
                  <div className={`bg-gradient-to-br ${c.grad} h-28 flex flex-col items-center justify-center relative`}>
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-white text-lg font-bold">{c.initials}</div>
                    {c.live && (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-[9px] font-bold text-white">LIVE</span>
                      </div>
                    )}
                  </div>
                  {/* Card body */}
                  <div className="p-3">
                    <div className="text-white text-sm font-semibold mb-0.5">{c.name}</div>
                    <div className="text-white/40 text-[11px] mb-2">{c.cat}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400 text-xs">★</span>
                        <span className="text-white/70 text-xs font-medium">{c.rating}</span>
                        <span className="text-white/30 text-[10px]">({c.reviews})</span>
                      </div>
                      <div className="h-6 w-16 rounded-lg bg-violet-600/50" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Overlay — darkens just enough for the auth card to pop */}
        <div className="absolute inset-0 bg-[#0c0c18]/70" />
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
              <p className="text-center text-xs text-brand-ink-subtle">
                Need help? <Link href="/support" className="font-semibold text-brand-primary hover:underline">Contact support</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
