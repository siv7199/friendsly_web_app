"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

interface GuestAuthModalProps {
  open: boolean;
  onClose: () => void;
  next?: string;
  initialTab?: Tab;
  reason?: string;
}

export function GuestAuthModal({
  open,
  onClose,
  next,
  initialTab = "signup",
  reason = "Create an account to continue.",
}: GuestAuthModalProps) {
  const router = useRouter();
  const { login, signup, isLoading, error } = useAuthContext();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    const result = await login(signInEmail.trim(), signInPassword);
    if (!result.success || !result.user) return;
    onClose();
    if (next) router.push(next);
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    const result = await signup(signUpEmail.trim(), signUpPassword, signUpName.trim(), next);
    if (result.requiresEmailConfirmation) {
      setMessage("Check your email to confirm your account, then come back to continue.");
      setTab("signin");
      setSignInEmail(signUpEmail.trim().toLowerCase());
      setSignUpPassword("");
      return;
    }
    if (result.signedIn) {
      onClose();
      router.push(next || "/discover");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} backdropClassName="bg-black/45 backdrop-blur-md">
      <DialogContent className="max-w-md bg-white" onClose={onClose}>
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <BrandLogo href="/" size="sm" theme="light" />
          <p className="max-w-[30ch] text-sm leading-6 text-brand-ink-muted">{reason}</p>
        </div>

        <div className="mb-4 flex rounded-[16px] border border-brand-border bg-brand-surface p-1 shadow-sm">
          {(["signin", "signup"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "flex-1 rounded-[13px] py-2 text-sm font-semibold transition-all duration-150",
                tab === item
                  ? "bg-[rgba(175,163,234,0.34)] text-brand-primary-deep shadow-sm"
                  : "text-brand-ink-muted hover:text-brand-ink"
              )}
            >
              {item === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {message ? (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <Input
              label="Email"
              type="email"
              value={signInEmail}
              onChange={(event) => setSignInEmail(event.target.value)}
              icon={<Mail className="h-4 w-4" />}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={signInPassword}
                onChange={(event) => setSignInPassword(event.target.value)}
                icon={<Lock className="h-4 w-4" />}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-[30px] flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:bg-brand-primary-bg hover:text-brand-primary-deep"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            <Button type="submit" variant="primary" size="sm" className="w-full" disabled={isLoading || !signInEmail.trim() || !signInPassword}>
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3">
            <Input
              label="Full Name"
              type="text"
              value={signUpName}
              onChange={(event) => setSignUpName(event.target.value)}
              icon={<User className="h-4 w-4" />}
              placeholder="Jordan Kim"
              required
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={signUpEmail}
              onChange={(event) => setSignUpEmail(event.target.value)}
              icon={<Mail className="h-4 w-4" />}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={signUpPassword}
                onChange={(event) => setSignUpPassword(event.target.value)}
                icon={<Lock className="h-4 w-4" />}
                placeholder="Create a password"
                required
                autoComplete="new-password"
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-[30px] flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:bg-brand-primary-bg hover:text-brand-primary-deep"
                aria-label={showPassword ? "Hide password" : "Show password"}
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
                I agree to the <Link href="/terms" className="font-semibold text-brand-primary hover:underline">Terms</Link> and{" "}
                <Link href="/privacy" className="font-semibold text-brand-primary hover:underline">Privacy Policy</Link>.
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
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="w-full"
              disabled={isLoading || !signUpName.trim() || !signUpEmail.trim() || !signUpPassword || !agreedToTerms || !confirmedAge}
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : "Create Fan Account"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
