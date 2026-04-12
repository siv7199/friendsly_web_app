"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MockProfile, UserRole } from "@/types";
import { sanitizeSocialUrl } from "@/lib/social";

export interface AuthState {
  user: MockProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

type AuthMetadataShape = {
  full_name: string;
  username: string;
  avatar_color: string;
  avatar_initials: string;
  role: UserRole | null;
};

// ── Build a minimal profile from JWT data (no DB call) ────────────────────────
function profileFromSession(session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }): MockProfile {
  const meta = session.user.user_metadata ?? {};
  const full_name = (meta.full_name as string) ?? "";
  const role = (meta.role as UserRole) ?? null;
  const initials = full_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    full_name,
    username: (meta.username as string) ?? "",
    avatar_initials: initials,
    avatar_color: (meta.avatar_color as string) ?? "bg-violet-600",
    avatar_url: meta.avatar_url as string | undefined,
    created_at: "",
    role,
  } as MockProfile;
}

function deriveInitials(fullName: string): string {
  return fullName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function buildAuthMetadata(input: {
  full_name?: string;
  username?: string;
  avatar_color?: string;
  role?: UserRole | null;
}): AuthMetadataShape {
  const fullName = input.full_name ?? "";

  return {
    full_name: fullName,
    username: input.username ?? "",
    avatar_color: input.avatar_color ?? "bg-violet-600",
    avatar_initials: deriveInitials(fullName),
    role: input.role ?? null,
  };
}

// ── Fetch full profile from DB (used for enriching state after nav) ───────────
async function fetchProfile(userId: string): Promise<MockProfile | null> {
  const supabase = createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, creator_profiles(*)")
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  const cp = Array.isArray(profile.creator_profiles)
    ? profile.creator_profiles[0]
    : profile.creator_profiles;

  const base = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    username: profile.username,
    avatar_initials: profile.avatar_initials,
    avatar_color: profile.avatar_color,
    avatar_url: profile.avatar_url ?? undefined,
    created_at: profile.created_at,
  };

  if (profile.role === "creator") {
    return {
      ...base,
      role: "creator",
      bio: cp?.bio ?? "",
      hourly_rate: 0,
      category: cp?.category ?? "",
      is_live: cp?.is_live ?? false,
      live_rate_per_minute: cp?.live_rate_per_minute ? Number(cp.live_rate_per_minute) : undefined,
      instagram_url: cp?.instagram_url ?? undefined,
      tiktok_url: cp?.tiktok_url ?? undefined,
      x_url: cp?.x_url ?? undefined,
    } as MockProfile;
  }
  if (profile.role === "fan") return { ...base, role: "fan" } as MockProfile;
  return { ...base, role: null } as unknown as MockProfile;
}

// ── The Hook ──────────────────────────────────────────────────────────────────

export function useAuth() {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // On mount: check for existing session, set state from JWT immediately
    async function init() {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((res) =>
            setTimeout(() => res({ data: { session: null } }), 4000)
          ),
        ]);
        if (!mounted) return;
        if (!session) { setState({ ...INITIAL_STATE }); return; }
        const user = profileFromSession(session);
        setState({ user, isAuthenticated: Boolean(user.role), isLoading: false, error: null });

        // Enrich with DB profile in background (non-blocking)
        fetchProfile(session.user.id).then((full) => {
          if (mounted && full) setState((s) => ({ ...s, user: full, isAuthenticated: Boolean(full.role) }));
        }).catch(() => {/* ignore */});
      } catch {
        if (mounted) setState({ ...INITIAL_STATE });
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      if (!session) {
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }
      // Set state from JWT immediately — no DB call
      const user = profileFromSession(session);
      setState({ user, isAuthenticated: Boolean(user.role), isLoading: false, error: null });

      // Enrich with DB profile in background (non-blocking)
      fetchProfile(session.user.id).then((full) => {
        if (mounted && full) setState((s) => ({ ...s, user: full, isAuthenticated: Boolean(full.role) }));
      }).catch(() => {/* ignore */});
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const preflightRes = await fetch("/api/auth/prelogin-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const preflight = await preflightRes.json().catch(() => null);
      if (!preflightRes.ok) {
        setState((s) => ({ ...s, isLoading: false, error: preflight?.error ?? "Could not verify login access." }));
        return;
      }

      if (preflight?.blocked) {
        const message = preflight.requestStatus === "rejected"
          ? "This creator application was not approved, so this account cannot sign in."
          : "This creator application is still pending review. You can sign in after it is approved.";
        setState((s) => ({ ...s, isLoading: false, error: message }));
        return;
      }

      const supabase = createClient();
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timed out — check your connection.")), 8000)),
      ]);
      if (error) {
        setState((s) => ({ ...s, isLoading: false, error: error.message }));
        return;
      }

      const session = data?.session ?? null;
      if (!session) {
        setState((s) => ({ ...s, isLoading: false, error: "Signed in, but no session was returned." }));
        return;
      }

      const sessionUser = profileFromSession(session);
      setState({
        user: sessionUser,
        isAuthenticated: Boolean(sessionUser.role),
        isLoading: false,
        error: null,
      });

      fetchProfile(session.user.id)
        .then((full) => {
          if (full) {
            const hasOversizedMetadata = typeof session.user.user_metadata?.avatar_url === "string";
            if (hasOversizedMetadata || !sessionUser.role) {
              void supabase.auth.updateUser({
                data: buildAuthMetadata({
                  full_name: full.full_name,
                  username: full.username,
                  avatar_color: full.avatar_color,
                  role: full.role,
                }),
              });
            }
            setState({
              user: full,
              isAuthenticated: Boolean(full.role),
              isLoading: false,
              error: null,
            });
          }
        })
        .catch(() => {
          // Keep the session-backed user if profile enrichment fails.
        });
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false, error: e instanceof Error ? e.message : "Something went wrong." }));
    }
  }, []);

  // ── signup ────────────────────────────────────────────────────────────────
  const signup = useCallback(async (
    email: string,
    password: string,
    full_name: string,
    nextPath?: string | null
  ): Promise<void> => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const supabase = createClient();
      const redirectUrl = typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`
        : undefined;
      const { data, error } = await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name },
            emailRedirectTo: redirectUrl,
          },
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timed out — check your connection.")), 8000)),
      ]);
      if (error) {
        setState((s) => ({ ...s, isLoading: false, error: error.message }));
        return;
      }
      if (data.user && !data.session) {
        setState((s) => ({ ...s, isLoading: false, error: "Check your email to confirm your account." }));
        return;
      }
      // State is set by onAuthStateChange — just clear loading
      setState((s) => ({ ...s, isLoading: false }));
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false, error: e instanceof Error ? e.message : "Something went wrong." }));
    }
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    const supabase = createClient();
    if (state.user?.role === "creator") {
      // End any active live session — the DB trigger sets is_live = false automatically.
      await supabase
        .from("live_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("creator_id", state.user.id)
        .eq("is_active", true);
    }
    await supabase.auth.signOut();
  }, [state.user]);

  // ── deleteAccount ─────────────────────────────────────────────────────────
  const deleteAccount = useCallback(async (): Promise<void> => {
    const supabase = createClient();
    await supabase.auth.admin?.deleteUser?.(state.user?.id ?? "");
    await supabase.auth.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
  }, [state.user?.id]);

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (updates: Partial<MockProfile>): Promise<void> => {
    if (!state.user) return;
    const supabase = createClient();

    const profileUpdates: Record<string, unknown> = {};
    const creatorUpdates: Record<string, unknown> = {};
    const nextFullName = "full_name" in updates ? (updates.full_name ?? state.user.full_name) : state.user.full_name;
    const nextInitials = deriveInitials(nextFullName);

    if ("full_name" in updates) {
      profileUpdates.full_name = updates.full_name;
      profileUpdates.avatar_initials = nextInitials;
    }
    if ("username" in updates) {
      profileUpdates.username = updates.username;
    }
    if ("avatar_url" in updates) {
      profileUpdates.avatar_url = updates.avatar_url;
    }
    if ("avatar_color" in updates) {
      profileUpdates.avatar_color = updates.avatar_color;
    }
    if ("role" in updates) {
      profileUpdates.role = updates.role;
    }

    if ("bio" in updates)      creatorUpdates.bio = (updates as { bio?: string }).bio;
    if ("category" in updates) creatorUpdates.category = (updates as { category?: string }).category;
    if ("is_live" in updates)  creatorUpdates.is_live = (updates as { is_live?: boolean }).is_live;
    if ("instagram_url" in updates) {
      creatorUpdates.instagram_url = sanitizeSocialUrl((updates as { instagram_url?: string }).instagram_url ?? "");
    }
    if ("tiktok_url" in updates) {
      creatorUpdates.tiktok_url = sanitizeSocialUrl((updates as { tiktok_url?: string }).tiktok_url ?? "");
    }
    if ("x_url" in updates) {
      creatorUpdates.x_url = sanitizeSocialUrl((updates as { x_url?: string }).x_url ?? "");
    }
    if ("live_rate_per_minute" in updates) {
      creatorUpdates.live_rate_per_minute = (updates as { live_rate_per_minute?: number }).live_rate_per_minute;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("profiles").update(profileUpdates).eq("id", state.user.id);
    }

    if (Object.keys(creatorUpdates).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("creator_profiles") as any).update(creatorUpdates).eq("id", state.user.id);
      if (error?.code === "PGRST116") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creator_profiles") as any).insert({ id: state.user.id, ...creatorUpdates });
      }
    }

    await supabase.auth.updateUser({
      data: buildAuthMetadata({
        full_name: nextFullName,
        username: ("username" in updates ? updates.username : state.user.username) ?? "",
        avatar_color: ("avatar_color" in updates ? updates.avatar_color : state.user.avatar_color) ?? "bg-violet-600",
        role: ("role" in updates ? updates.role : state.user.role) ?? null,
      }),
    });

    // Update local state optimistically
    setState((s) => ({
      ...s,
      user: s.user ? { ...s.user, ...updates, avatar_initials: nextInitials } as MockProfile : null,
      isAuthenticated: Boolean(updates.role ?? s.user?.role),
    }));
  }, [state.user]);

  // ── setRole ───────────────────────────────────────────────────────────────
  const setRole = useCallback(async (role: UserRole): Promise<void> => {
    if (!state.user) return;
    const supabase = createClient();

    await supabase.from("profiles").update({ role }).eq("id", state.user.id);
    await supabase.auth.updateUser({
      data: buildAuthMetadata({
        full_name: state.user.full_name,
        username: state.user.username,
        avatar_color: state.user.avatar_color,
        role,
      }),
    });

    if (role === "creator") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("creator_profiles") as any).upsert({ id: state.user.id }, { onConflict: "id" });
    }

    setState((s) => ({
      ...s,
      user: s.user ? { ...s.user, role } as MockProfile : null,
      isAuthenticated: true,
    }));
  }, [state.user]);

  return { ...state, login, signup, logout, deleteAccount, updateProfile, setRole };
}
