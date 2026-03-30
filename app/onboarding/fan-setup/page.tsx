"use client";

/**
 * Fan Setup  (route: /onboarding/fan-setup)
 *
 * Simple single-step form. Fans just confirm or set their username.
 * After submit → /discover
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";

export default function FanSetupPage() {
  const router = useRouter();
  const { user, updateProfile } = useAuthContext();

  const [username, setUsername] = useState(user?.username ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    updateProfile({ username });
    router.push("/discover");
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-brand-primary opacity-10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Compass className="w-3.5 h-3.5 text-brand-primary-light" />
            <span className="text-xs text-slate-400 font-medium">Fan Setup — Almost done!</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">One last thing</h1>
          <p className="text-slate-400 text-sm mt-1">Confirm your username and start discovering.</p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <Avatar
              initials={user?.avatar_initials ?? "?"}
              color={user?.avatar_color ?? "bg-violet-500"}
              size="xl"
            />
            <p className="text-base font-bold text-slate-100">{user?.full_name}</p>
          </div>

          {/* Username input */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">Your username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">@</span>
              <input
                type="text"
                placeholder="jordankim"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())}
                className="w-full h-10 pl-7 pr-3 rounded-xl border border-brand-border bg-brand-elevated text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              This is how you&apos;ll appear in chat and queues.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting || !username.trim()}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                Start Discovering
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
