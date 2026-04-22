/**
 * middleware.ts
 *
 * Runs at the Edge before every request.
 * Two jobs:
 *  1. Refresh the Supabase session cookies (keeps the user logged in).
 *  2. Redirect unauthenticated / wrong-role users to the right page.
 *
 * Role is stored in auth.users.user_metadata.role (set during onboarding).
 * We read it from the decoded JWT so there's no extra DB round-trip here.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SHARED_PROTECTED  = ["/settings", "/room", "/m/room"];
const PROTECTED_FAN     = ["/discover", "/profile", "/waiting-room", "/bookings", "/payments", "/saved", "/m/waiting-room"];
const PROTECTED_CREATOR = ["/dashboard", "/management", "/calendar", "/live", "/earnings", "/m/live"];
const MOBILE_CALL_ROUTES = ["/waiting-room", "/live", "/room", "/guest-room"];
const ONBOARDING_PREFIX = "/onboarding";
const AUTH_ROUTES       = ["/login", "/signup"];

function isProtected(pathname: string): boolean {
  return [...SHARED_PROTECTED, ...PROTECTED_FAN, ...PROTECTED_CREATOR].some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname === r);
}

function matchesProtectedRoute(pathname: string, routes: string[]): boolean {
  return routes.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Supabase SSR client — refreshes session cookies on every request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // iPhone UA detection — redirect call routes to mobile-specific pages
  const ua = request.headers.get("user-agent") ?? "";
  if (/iPhone/i.test(ua)) {
    const path = request.nextUrl.pathname;
    const needsRedirect = MOBILE_CALL_ROUTES.some(
      (r) => path === r || (path.startsWith(r + "/") && !path.startsWith("/m/"))
    );
    if (needsRedirect) {
      return NextResponse.redirect(new URL(`/m${path}`, request.url));
    }
  }

  // getSession decodes the local JWT — no network call
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  let role = session?.user?.user_metadata?.role as string | undefined;

  // Fallback for older accounts whose DB profile role exists but JWT metadata
  // has not been synced yet. This prevents login/redirect loops on protected routes.
  if (!role && session?.user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role) {
      role = profile.role;
    }
  }

  const isPending   = Boolean(session && !role);
  const isFullAuth  = Boolean(session && role);

  // 1. Fully authenticated → bounce away from auth pages
  if (isFullAuth && isAuthRoute(pathname)) {
    return NextResponse.redirect(
      new URL(role === "creator" ? "/dashboard" : "/discover", request.url)
    );
  }

  // 2. Fully authenticated → allow everywhere
  if (isFullAuth) {
    const onCreatorRoute = matchesProtectedRoute(pathname, PROTECTED_CREATOR);
    const onFanRoute = matchesProtectedRoute(pathname, PROTECTED_FAN);
    const onSharedRoute = matchesProtectedRoute(pathname, SHARED_PROTECTED);

    if (onSharedRoute) {
      return response;
    }

    if (role === "fan" && onCreatorRoute) {
      return NextResponse.redirect(new URL("/discover", request.url));
    }

    if (role === "creator" && onFanRoute) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  }

  // 3. Pending (signed up, no role yet) → allow onboarding + auth
  if (isPending) {
    if (pathname.startsWith(ONBOARDING_PREFIX) || isAuthRoute(pathname)) {
      return response;
    }
    return NextResponse.redirect(new URL("/onboarding/role", request.url));
  }

  // 4. No session → allow auth page
  if (isAuthRoute(pathname)) return response;

  // 5. No session + protected route → send to login
  if (isProtected(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|api/).*)",
  ],
};
