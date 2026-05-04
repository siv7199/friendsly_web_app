"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, LogIn, LogOut, Settings, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { GuestAuthModal } from "@/components/shared/GuestAuthModal";

export function MobileAccountBar({ floating = true }: { floating?: boolean }) {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"signin" | "signup">("signup");

  async function handleLogout() {
    await logout();
    window.location.replace("/");
  }

  if (!user) {
    return (
      <>
        <div
          className={cn(
            "bg-white/95 px-4 shadow-[0_10px_30px_rgba(26,22,40,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/88",
            floating
              ? "fixed inset-x-0 top-0 z-50 border-b border-brand-border/70 md:bottom-0 md:top-auto md:border-b-0 md:border-t md:border-brand-border/70 md:shadow-[0_-10px_30px_rgba(26,22,40,0.06)]"
              : "relative z-10 mb-4 border-b border-brand-border/70"
          )}
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
            paddingBottom: "0.75rem",
          }}
        >
          <div className="flex w-full items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-ink">Browsing as guest</p>
              <p className="truncate text-xs text-brand-ink-subtle">Sign in to book, chat, or join queues.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAuthInitialTab("signin");
                setAuthOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 text-xs font-semibold text-brand-ink-subtle transition-colors hover:text-brand-ink"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthInitialTab("signup");
                setAuthOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create
            </button>
          </div>
        </div>
        <GuestAuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          initialTab={authInitialTab}
          reason="Sign in or create an account to book, chat, or join queues."
        />
      </>
    );
  }

  return (
    <div
      className={cn(
        "bg-white/95 px-4 shadow-[0_10px_30px_rgba(26,22,40,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/88",
        floating
          ? "fixed inset-x-0 top-0 z-50 border-b border-brand-border/70 md:bottom-0 md:top-auto md:border-b-0 md:border-t md:border-brand-border/70 md:shadow-[0_-10px_30px_rgba(26,22,40,0.06)]"
          : "relative z-10 mb-4 border-b border-brand-border/70"
      )}
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        paddingBottom: "0.75rem",
      }}
    >
      <div className="flex w-full items-center gap-3">
        <Avatar
          initials={user?.avatar_initials ?? "?"}
          color={user?.avatar_color ?? "bg-violet-600"}
          size="sm"
          imageUrl={user?.avatar_url && user?.id ? `/api/public/avatar/${user.id}` : undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-ink">
            {user?.full_name ?? "Friendsly"}
          </p>
          <p className="truncate text-xs text-brand-ink-subtle">
            {user?.username ? `@${user.username}` : "Signed in"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="rounded-xl border border-brand-border bg-brand-surface p-2 text-brand-ink-subtle transition-colors hover:text-brand-ink"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/support")}
          className="rounded-xl border border-brand-border bg-brand-surface p-2 text-brand-ink-subtle transition-colors hover:text-brand-ink"
          aria-label="Support"
        >
          <LifeBuoy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-xl border border-brand-border bg-brand-surface p-2 text-brand-ink-subtle transition-colors hover:border-red-200 hover:text-red-500"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
