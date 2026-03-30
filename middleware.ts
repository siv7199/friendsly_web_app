/**
 * middleware.ts  (root level — Next.js runs this at the Edge before every request)
 *
 * WHAT THIS DOES:
 * Reads the "mock_session_role" cookie and decides where to send the user.
 * This is the gatekeeper for all protected routes.
 *
 * WHY COOKIES AND NOT LOCALSTORAGE?
 * Middleware runs on the server (Edge runtime) — it has no access to the
 * browser's localStorage. Cookies are sent with every HTTP request, so
 * the server can read them before deciding whether to serve or redirect.
 *
 * COOKIE FORMAT:  "fan|<uuid>"  |  "creator|<uuid>"  |  "pending|<uuid>"
 *
 * REDIRECT RULES:
 * ┌──────────────────────────────┬─────────────────────┬───────────────────────┐
 * │ Cookie state                 │ Accessing...        │ Action                │
 * ├──────────────────────────────┼─────────────────────┼───────────────────────┤
 * │ No cookie                    │ protected route     │ → / (auth page)       │
 * │ No cookie                    │ / (auth page)       │ allow                 │
 * │ "pending|..."                │ /onboarding/*       │ allow                 │
 * │ "pending|..."                │ anything else       │ → /onboarding/role    │
 * │ "fan|..."                    │ /login, /signup     │ → /discover           │
 * │ "creator|..."                │ /login, /signup     │ → /dashboard          │
 * │ "fan|..." or "creator|..."   │ protected route     │ allow                 │
 * └──────────────────────────────┴─────────────────────┴───────────────────────┘
 *
 * → Future Supabase replacement:
 *   import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
 *   const supabase = createMiddlewareClient({ req, res })
 *   const { data: { session } } = await supabase.auth.getSession()
 *   Then fetch role from the profiles table and apply the same redirect logic.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Route classifications ─────────────────────────────────────────────

/** Routes that require a fully authenticated session (role must be set) */
const PROTECTED_ROUTES = [
  "/discover",
  "/bookings",
  "/saved",
  "/fan-profile",
  "/profile",
  "/waiting-room",
  "/dashboard",
  "/management",
  "/calendar",
  "/live",
  "/settings",
];

/** Routes that a logged-in user should be bounced away from (auth lives at "/") */
const AUTH_ROUTES = ["/", "/login", "/signup"];

/** Routes only reachable during the "pending" (post-signup, pre-role) state */
const ONBOARDING_PREFIX = "/onboarding";

// ── Helper ────────────────────────────────────────────────────────────

function parseCookie(request: NextRequest): {
  role: string | null;
  userId: string | null;
} {
  const raw = request.cookies.get("mock_session_role")?.value ?? "";
  const [role, userId] = raw.split("|");
  return {
    role: role || null,
    userId: userId || null,
  };
}

function isProtected(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route);
}

// ── Middleware ────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { role, userId } = parseCookie(request);

  const isFullyAuthenticated = Boolean(role && userId && role !== "pending");
  const isPending = role === "pending" && Boolean(userId);

  // 1. Fully authenticated → bounce away from auth pages
  if (isFullyAuthenticated && isAuthRoute(pathname)) {
    const dest = role === "creator" ? "/dashboard" : "/discover";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // 2. Fully authenticated → allow everywhere (they have a role)
  if (isFullyAuthenticated) {
    return NextResponse.next();
  }

  // 3. Pending (signed up, no role yet) → allow onboarding + auth routes
  //    (auth routes = "/" so users with a stale pending cookie can still log in)
  if (isPending) {
    if (pathname.startsWith(ONBOARDING_PREFIX) || isAuthRoute(pathname)) {
      return NextResponse.next();
    }
    // Anywhere else → send them to finish onboarding
    return NextResponse.redirect(new URL("/onboarding/role", request.url));
  }

  // 4. No session at all — only allow the auth page itself
  if (pathname === "/" || isAuthRoute(pathname)) {
    return NextResponse.next();
  }

  // 5. Trying to access a protected route with no session → auth page
  if (isProtected(pathname)) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Everything else (static files, API routes handled by matcher) — allow
  return NextResponse.next();
}

// ── Matcher ───────────────────────────────────────────────────────────

/**
 * The matcher tells Next.js which requests to run middleware on.
 * We exclude static files and the Next.js internals to avoid overhead.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};
