"use client";

/**
 * lib/hooks/useAuth.ts
 *
 * The core authentication hook. Manages all auth state in one place.
 *
 * HOW IT WORKS:
 * 1. On first render (mount), it reads the cookie + localStorage synchronously
 *    and hydrates the user state — so logged-in users never see a flash of
 *    the unauthenticated state.
 *
 * 2. login() and signup() simulate a real network call with an 800ms delay,
 *    then persist data to localStorage + cookie.
 *
 * 3. logout() is instant — clears both storage layers and resets state.
 *
 * IMPORTANT: This hook is NOT used directly by components.
 * Components use `useAuthContext()` from AuthContext.tsx instead.
 * This hook is the implementation; the context is the distribution layer.
 */

import { useState, useEffect, useCallback } from "react";
import type { MockProfile, UserRole } from "@/types";
import {
  getProfile,
  getProfileByEmail,
  saveProfile,
  clearProfile,
  setCookieSession,
  clearCookieSession,
  readCookieSession,
  createPendingProfile,
} from "@/lib/mock-auth";

// ── State Shape ───────────────────────────────────────────────────────

export interface AuthState {
  user: MockProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;   // true during async ops AND on first mount before hydration
  error: string | null;
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,  // start true — prevents flash of unauthenticated UI
  error: null,
};

// ── The Hook ──────────────────────────────────────────────────────────

export function useAuth() {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // ── Hydration on mount ─────────────────────────────────────────────
  // Reads localStorage + cookie synchronously on first render.
  // No async delay — storage reads are near-instant.
  useEffect(() => {
    const cookieSession = readCookieSession();
    const profile = cookieSession ? getProfile(cookieSession.userId) : null;

    if (cookieSession && profile && cookieSession.userId === profile.id && profile.role) {
      // Valid session: cookie and profile map are consistent, role is set
      setState({
        user: profile,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } else {
      // No session, or incomplete (pending role) — treat as logged out
      setState({ ...INITIAL_STATE, isLoading: false });
    }
  }, []);

  // ── login ──────────────────────────────────────────────────────────
  /**
   * Simulates sign-in. Any email/password works — no real validation.
   *
   * → Future Supabase:
   *   const { data, error } = await supabase.auth.signInWithPassword({ email, password })
   *   if (error) throw error
   *   const { data: profile } = await supabase.from('profiles').select().eq('id', data.user.id).single()
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Suppress unused-variable warning for password in mock mode
    void password;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 800));

    try {
      const profile = getProfileByEmail(email);

      if (profile) {
        // Returning user — restore their session
        if (!profile.role) {
          // They signed up but never finished onboarding — send them back
          setCookieSession("pending", profile.id);
          setState({ user: profile, isAuthenticated: false, isLoading: false, error: null });
          return;
        }
        setCookieSession(profile.role, profile.id);
        setState({ user: profile, isAuthenticated: true, isLoading: false, error: null });
      } else {
        // No stored profile for this email — create a minimal one
        // (handles the case where localStorage was cleared or it's a new device)
        const newProfile = createPendingProfile(email, email.split("@")[0]);
        saveProfile(newProfile);
        setCookieSession("pending", newProfile.id);
        setState({ user: newProfile, isAuthenticated: false, isLoading: false, error: null });
      }
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Login failed. Please try again.",
      }));
    }
  }, []);

  // ── signup ─────────────────────────────────────────────────────────
  /**
   * Creates a new pending profile (role not yet assigned).
   * After signup, the user is sent to /onboarding/role.
   *
   * → Future Supabase:
   *   const { data, error } = await supabase.auth.signUp({ email, password })
   *   await supabase.from('profiles').insert({ id: data.user.id, email, full_name, ... })
   */
  const signup = useCallback(async (
    email: string,
    _password: string,
    full_name: string
  ): Promise<void> => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    await new Promise((r) => setTimeout(r, 800));

    try {
      const profile = createPendingProfile(email, full_name);
      saveProfile(profile);
      // Cookie set to "pending" — middleware allows /onboarding/* only
      setCookieSession("pending", profile.id);
      setState({ user: profile, isAuthenticated: false, isLoading: false, error: null });
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Signup failed. Please try again.",
      }));
    }
  }, []);

  // ── logout ─────────────────────────────────────────────────────────
  /**
   * Clears the session cookie and resets state.
   * The profile stays in localStorage so the user can log back in.
   *
   * → Future Supabase:
   *   await supabase.auth.signOut()
   *   (session cleared automatically; profile row stays in DB)
   */
  const logout = useCallback((): void => {
    clearCookieSession();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  // ── deleteAccount ──────────────────────────────────────────────────
  /**
   * Permanently removes the profile from localStorage AND clears the
   * session cookie. Used by the "Delete Account" button in settings.
   * Unlike logout(), this cannot be undone.
   */
  const deleteAccount = useCallback((): void => {
    const session = readCookieSession();
    clearCookieSession();
    if (session?.userId) clearProfile(session.userId);
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  // ── updateProfile ──────────────────────────────────────────────────
  /**
   * Merges partial updates into the current profile and persists.
   * Used by: onboarding steps, settings page.
   *
   * → Future Supabase:
   *   await supabase.from('profiles').update(updates).eq('id', user.id)
   */
  const updateProfile = useCallback((updates: Partial<MockProfile>): void => {
    setState((s) => {
      if (!s.user) return s;
      const merged = { ...s.user, ...updates } as MockProfile;
      saveProfile(merged);
      // If role just changed, update the cookie
      if (updates.role && updates.role !== s.user.role) {
        setCookieSession(updates.role as UserRole, merged.id);
      }
      return {
        ...s,
        user: merged,
        isAuthenticated: !!merged.role,
      };
    });
  }, []);

  // ── setRole ────────────────────────────────────────────────────────
  /**
   * Convenience method for the onboarding role-selection page.
   * Equivalent to updateProfile({ role }) but also flips isAuthenticated.
   */
  const setRole = useCallback((role: UserRole): void => {
    setState((s) => {
      if (!s.user) return s;
      const merged = { ...s.user, role } as MockProfile;
      saveProfile(merged);
      setCookieSession(role, merged.id);
      return { ...s, user: merged, isAuthenticated: true };
    });
  }, []);

  return {
    ...state,
    login,
    signup,
    logout,
    deleteAccount,
    updateProfile,
    setRole,
  };
}
