"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkRecoverySession() {
      const { data } = await supabase.auth.getSession();
      setHasRecoverySession(Boolean(data.session));
    }

    void checkRecoverySession();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess("Password updated. Redirecting you back to sign in...");
      setTimeout(() => {
        router.replace("/login?tab=signin");
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f18] px-4 py-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <img
          src="/fan_dashboard.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ filter: "blur(6px)", transform: "scale(1.04)" }}
        />
        <div className="absolute inset-0 bg-[#0c0c18]/65" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <div className="overflow-hidden rounded-[36px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,246,255,0.96))] px-5 py-6 shadow-[0_28px_90px_rgba(12,12,24,0.22)] backdrop-blur-sm md:px-8 md:py-8">
          <div className="rounded-[28px] border border-[rgba(133,117,201,0.18)] bg-white px-5 py-6 shadow-[0_18px_50px_rgba(55,33,110,0.12)] md:px-7 md:py-7">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <BrandLogo href="/" size="md" theme="light" />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-brand-ink">Choose a new password</h1>
                <p className="text-sm text-brand-ink-subtle">
                  Use the link from your email to reset your Friendsly password securely.
                </p>
              </div>
            </div>

            {hasRecoverySession === false ? (
              <div className="space-y-4">
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This reset link is missing or expired. Request a new one from the sign-in page.
                </p>
                <Link href="/login?tab=signin" className="block">
                  <Button variant="primary" size="lg" className="w-full">
                    Back to sign in
                  </Button>
                </Link>
              </div>
            ) : hasRecoverySession === null ? (
              <div className="flex items-center justify-center py-10 text-brand-ink-subtle">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    label="New Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    required
                    autoComplete="new-password"
                    className="pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-[30px] flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:bg-brand-primary-bg hover:text-brand-primary-deep focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Input
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  required
                  autoComplete="new-password"
                />

                <p className="text-xs leading-relaxed text-brand-ink-subtle">
                  Keep it at least 8 characters long. Matching passwords are required before you can continue.
                </p>

                {error ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {success}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={submitting || !password || !confirmPassword}
                >
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating password...</> : "Update password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
