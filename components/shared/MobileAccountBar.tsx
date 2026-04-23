"use client";

import { useRouter } from "next/navigation";
import { LifeBuoy, LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";

export function MobileAccountBar({ floating = true }: { floating?: boolean }) {
  const { user, logout } = useAuthContext();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    window.location.replace("/");
  }

  return (
    <div
      className={cn(
        "border-b border-brand-border/70 bg-white/95 px-4 shadow-[0_10px_30px_rgba(26,22,40,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/88 md:hidden",
        floating
          ? "fixed inset-x-0 top-0 z-50 pb-3"
          : "relative z-10 mb-4 pb-3"
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
