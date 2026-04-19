"use client";

/**
 * Role Selection Page  (route: /onboarding/role)
 *
 * New users can self-serve as fans.
 * Creator accounts are manually reviewed, so the creator card routes to
 * an application form instead of assigning the role directly.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Sparkles, Zap, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  {
    role: "fan" as const,
    title: "I'm a Fan",
    description: "Discover creators, book 1-on-1 calls, and join live sessions with people who inspire you.",
    icon: Users,
    perks: ["Browse all creators", "Book video calls", "Watch public lives", "Direct access to experts"],
    accentBorder: "hover:border-brand-primary",
    accentGlow: "hover:shadow-glow-primary",
    iconBg: "bg-brand-primary/20 text-brand-primary-light",
    cta: "Continue as Fan ->",
    ctaColor: "text-brand-primary-light",
  },
  {
    role: "creator" as const,
    title: "I'm a Creator",
    description: "Apply for a verified creator account so your profile can be reviewed before you start monetizing.",
    icon: Sparkles,
    perks: ["Manual account review", "Protected creator marketplace", "Verified onboarding", "Access after approval"],
    accentBorder: "hover:border-brand-gold",
    accentGlow: "hover:shadow-glow-gold",
    iconBg: "bg-brand-gold/20 text-brand-gold",
    cta: "Request Creator Access ->",
    ctaColor: "text-brand-gold",
  },
] as const;

export default function RoleSelectionPage() {
  const router = useRouter();
  const { user, setRole, isLoading } = useAuthContext();
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next"));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "fan") router.replace(next || "/discover");
    else if (user?.role === "creator") router.replace("/dashboard");
    else if (!user) router.replace("/");
  }, [user, isLoading, next, router]);

  async function handleFanSelect() {
    await setRole("fan");
    router.push(next ? `/onboarding/fan-setup?next=${encodeURIComponent(next)}` : "/onboarding/fan-setup");
  }

  return (
    <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[500px] h-[500px] rounded-full bg-brand-primary opacity-8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] rounded-full bg-amber-900 opacity-8 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
          <Zap className="w-3.5 h-3.5 text-brand-gold" />
          <span className="text-xs text-brand-ink-subtle font-medium">Step 1 of 2 - Choose your role</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-normal text-brand-ink">
          How will you use <span className="text-gradient-primary">Friendsly</span>?
        </h1>
        <p className="text-brand-ink-subtle mt-2">
          {user?.full_name ? `Hey ${user.full_name.split(" ")[0]}, pick the path that fits you.` : "Pick the path that fits you best."}
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl animate-slide-up">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const content = (
            <>
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors", option.iconBg)}>
                <Icon className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2">{option.title}</h2>
              <p className="text-brand-ink-subtle text-sm leading-relaxed mb-5">{option.description}</p>

              <div className="space-y-2 mb-6">
                {option.perks.map((perk) => (
                  <div key={perk} className="flex items-center gap-2 text-sm text-brand-ink-subtle">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-live shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              {option.role === "creator" && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-3 py-2 text-xs text-brand-ink-subtle">
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-gold" />
                  <span>Creator access is approved manually before accounts can go live or accept paid bookings.</span>
                </div>
              )}

              <div className={cn("flex items-center gap-1.5 font-semibold text-sm group-hover:gap-2.5 transition-all", option.ctaColor)}>
                {option.cta}
              </div>
            </>
          );

          const className = cn(
            "glass-card rounded-2xl p-7 text-left transition-all duration-300 group border",
            "hover:-translate-y-1",
            option.accentBorder,
            option.accentGlow
          );

          if (option.role === "creator") {
            return (
              <Link key={option.role} href="/onboarding/creator-request" className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button key={option.role} onClick={handleFanSelect} className={cn(className, "cursor-pointer")}>
              {content}
            </button>
          );
        })}
      </div>
    </main>
  );
}
