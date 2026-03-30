"use client";

/**
 * Role Selection Page  (route: /onboarding/role)
 *
 * The first step after signup. The user picks Fan or Creator.
 * This sets the role in the profile + updates the cookie from
 * "pending|uuid" → "fan|uuid" or "creator|uuid".
 *
 * After picking:
 *   Fan     → /onboarding/fan-setup
 *   Creator → /onboarding/creator-setup
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Sparkles, Zap, CheckCircle2 } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  {
    role: "fan" as UserRole,
    title: "I'm a Fan",
    description: "Discover creators, book 1-on-1 calls, and join live sessions with people who inspire you.",
    icon: Users,
    perks: ["Browse all creators", "Book video calls", "Join live queues", "Direct access to experts"],
    accentBorder: "hover:border-brand-primary",
    accentGlow: "hover:shadow-glow-primary",
    iconBg: "bg-brand-primary/20 text-brand-primary-light",
    tagColor: "bg-brand-primary/10 text-brand-primary-light border-brand-primary/20",
    cta: "Continue as Fan →",
    ctaColor: "text-brand-primary-light",
  },
  {
    role: "creator" as UserRole,
    title: "I'm a Creator",
    description: "Monetize your audience. Set your prices, go live, and manage 1-on-1 bookings — all in one place.",
    icon: Sparkles,
    perks: ["Set your own prices", "Go live anytime", "Manage your calendar", "Get paid directly"],
    accentBorder: "hover:border-brand-gold",
    accentGlow: "hover:shadow-glow-gold",
    iconBg: "bg-brand-gold/20 text-brand-gold",
    tagColor: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
    cta: "Continue as Creator →",
    ctaColor: "text-brand-gold",
  },
] as const;

export default function RoleSelectionPage() {
  const router = useRouter();
  const { user, setRole, isLoading } = useAuthContext();

  useEffect(() => {
    if (isLoading) return;
    // Already has a role — skip onboarding
    if (user?.role === "fan") router.replace("/discover");
    else if (user?.role === "creator") router.replace("/dashboard");
    // Stale cookie with no matching profile — send to login
    else if (!user) router.replace("/");
  }, [user, isLoading, router]);

  async function handleSelect(role: UserRole) {
    setRole(role);
    // Small delay so the cookie write completes before middleware reads it on next navigation
    await new Promise((r) => setTimeout(r, 50));
    router.push(role === "fan" ? "/onboarding/fan-setup" : "/onboarding/creator-setup");
  }

  return (
    <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[500px] h-[500px] rounded-full bg-brand-primary opacity-8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] rounded-full bg-amber-900 opacity-8 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
          <Zap className="w-3.5 h-3.5 text-brand-gold" />
          <span className="text-xs text-slate-400 font-medium">Step 1 of 2 — Choose your role</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-100">
          How will you use{" "}
          <span className="text-gradient-primary">Friendsly</span>?
        </h1>
        <p className="text-slate-400 mt-2">
          {user?.full_name ? `Hey ${user.full_name.split(" ")[0]}, pick the role that fits you.` : "Pick the role that fits you best. You can always change this later."}
        </p>
      </div>

      {/* Role cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl animate-slide-up">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.role}
              onClick={() => handleSelect(option.role)}
              className={cn(
                "glass-card rounded-2xl p-7 text-left cursor-pointer transition-all duration-300 group border",
                "hover:-translate-y-1",
                option.accentBorder,
                option.accentGlow
              )}
            >
              {/* Icon */}
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors", option.iconBg)}>
                <Icon className="w-7 h-7" />
              </div>

              {/* Title + description */}
              <h2 className="text-xl font-bold text-white mb-2">{option.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                {option.description}
              </p>

              {/* Perks */}
              <div className="space-y-2 mb-6">
                {option.perks.map((perk) => (
                  <div key={perk} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-live shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className={cn("flex items-center gap-1.5 font-semibold text-sm group-hover:gap-2.5 transition-all", option.ctaColor)}>
                {option.cta}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
