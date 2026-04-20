"use client";

/**
 * lib/context/AuthContext.tsx
 *
 * The distribution layer for auth state.
 *
 * WHY A CONTEXT ON TOP OF THE HOOK?
 * Without context, every component calling useAuth() would have its
 * OWN isolated state. The sidebar, the page body, and the navbar
 * would all be running separate instances of the hook and could get
 * out of sync.
 *
 * With context: useAuth() runs ONCE in AuthProvider at the top of the
 * tree. Every component that calls useAuthContext() reads from that
 * single shared state — like a global store, but built into React.
 *
 * USAGE IN COMPONENTS:
 *   import { useAuthContext } from "@/lib/context/AuthContext"
 *   const { user, login, logout } = useAuthContext()
 */

import React, { createContext, useContext } from "react";
import { useAuth, type OAuthProvider, type SignupResult } from "@/lib/hooks/useAuth";
import type { MockProfile, UserRole } from "@/types";

// ── Context Shape ─────────────────────────────────────────────────────

interface AuthContextValue {
  user: MockProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, full_name: string, nextPath?: string | null) => Promise<SignupResult>;
  signInWithOAuth: (provider: OAuthProvider, nextPath?: string | null) => Promise<void>;
  logout: () => void;
  deleteAccount: () => void;
  updateProfile: (updates: Partial<MockProfile>) => void;
  setRole: (role: UserRole) => void;
}

// ── Context Object ────────────────────────────────────────────────────

// undefined as default — useAuthContext() will catch this and throw a helpful error
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────

/**
 * AuthProvider — wrap this around your app (in app/layout.tsx).
 *
 * It's a Client Component but it's safe to import into a Server
 * Component layout — Next.js allows this as long as the provider
 * just wraps {children} without rendering server-only data itself.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Consumer Hook ─────────────────────────────────────────────────────

/**
 * useAuthContext — the hook every component should import.
 *
 * Throws a descriptive error if called outside <AuthProvider>,
 * which makes debugging much easier during development.
 *
 * → Future Supabase: this hook signature stays identical.
 *   You only change the implementation inside AuthProvider / useAuth.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error(
      "useAuthContext() must be used inside <AuthProvider>. " +
      "Make sure app/layout.tsx wraps its children with <AuthProvider>."
    );
  }
  return ctx;
}
