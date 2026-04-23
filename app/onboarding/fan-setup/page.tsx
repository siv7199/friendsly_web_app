"use client";

/**
 * Fan Setup  (route: /onboarding/fan-setup)
 * Confirm username + pick avatar color → /discover
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { removeAvatarFile, uploadAvatarFile } from "@/lib/avatar-upload";

const AVATAR_COLORS = [
  { cls: "bg-violet-600",  hex: "#7c3aed" },
  { cls: "bg-purple-600",  hex: "#9333ea" },
  { cls: "bg-indigo-600",  hex: "#4f46e5" },
  { cls: "bg-blue-600",    hex: "#2563eb" },
  { cls: "bg-cyan-600",    hex: "#0891b2" },
  { cls: "bg-teal-600",    hex: "#0d9488" },
  { cls: "bg-green-600",   hex: "#16a34a" },
  { cls: "bg-amber-500",   hex: "#f59e0b" },
  { cls: "bg-orange-500",  hex: "#f97316" },
  { cls: "bg-rose-600",    hex: "#e11d48" },
  { cls: "bg-pink-600",    hex: "#db2777" },
  { cls: "bg-red-600",     hex: "#dc2626" },
];

export default function FanSetupPage() {
  const router = useRouter();
  const { user, updateProfile, setRole } = useAuthContext();
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next"));
  }, []);

  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color ?? "bg-violet-600");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const initials = (user?.full_name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  async function handleSubmit() {
    setSubmitting(true);
    // Auto-assign fan role if not already set (skipping the role picker)
    if (!user?.role) {
      await setRole("fan");
    }
    await (updateProfile as (u: Parameters<typeof updateProfile>[0]) => Promise<void>)({
      username,
      avatar_color: avatarColor,
      avatar_url: avatarUrl,
    });
    router.push(next || "/discover");
  }

  async function handleAvatarSelected(file?: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const nextAvatarUrl = await uploadAvatarFile(file);
      setAvatarUrl(nextAvatarUrl);
      setAvatarVersion(Date.now());
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarRemoved() {
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      await removeAvatarFile();
      setAvatarUrl("");
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not remove avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-brand-primary opacity-10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Compass className="w-3.5 h-3.5 text-brand-primary-light" />
            <span className="text-xs text-brand-ink-subtle font-medium">Fan Setup — Almost done!</span>
          </div>
          <h1 className="text-2xl font-serif font-normal text-brand-ink">One last thing</h1>
          <p className="text-brand-ink-subtle text-sm mt-1">Pick your avatar color and confirm your username.</p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                initials={initials}
                color={avatarColor}
                size="xl"
                imageUrl={avatarUrl && user?.id ? `/api/public/avatar/${user.id}?v=${avatarVersion}` : undefined}
              />
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-primary border-2 border-brand-surface flex items-center justify-center cursor-pointer hover:bg-brand-primary-hover transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleAvatarSelected(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-base font-bold text-brand-ink">{user?.full_name}</p>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => void handleAvatarRemoved()}
                className="text-xs text-red-600 hover:text-red-700 -mt-2"
                disabled={uploadingAvatar}
              >
                Remove photo
              </button>
            )}
            {avatarError && (
              <p className="text-xs text-red-400 -mt-2">{avatarError}</p>
            )}
            {uploadingAvatar && (
              <p className="text-xs text-brand-ink-subtle -mt-2">Uploading photo...</p>
            )}
            <p className="text-xs text-brand-ink-muted">Pick a background color</p>
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_COLORS.map(({ cls, hex }) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setAvatarColor(cls)}
                  style={{ backgroundColor: hex }}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    avatarColor === cls
                      ? "ring-2 ring-white ring-offset-2 ring-offset-brand-elevated scale-110"
                      : "hover:scale-105"
                  )}
                  aria-label={cls}
                />
              ))}
            </div>
          </div>

          {/* Username input */}
          <div>
            <label className="text-sm font-medium text-brand-ink-subtle mb-1.5 block">Your username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-muted text-sm pointer-events-none">@</span>
              <input
                type="text"
                placeholder="jordankim"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())}
                className="w-full h-10 pl-7 pr-3 rounded-xl border border-brand-border bg-brand-elevated text-sm text-brand-ink placeholder:text-brand-ink-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <p className="text-xs text-brand-ink-muted mt-1.5">
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
