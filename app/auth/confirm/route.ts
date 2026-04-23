/**
 * app/auth/confirm/route.ts
 *
 * Server-side email confirmation endpoint for Supabase token-hash links.
 * Unlike PKCE auth-code exchanges, this route does not depend on the
 * original browser/device still having the code verifier in storage.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function sanitizeNextPath(next: string | null, fallback: string) {
  const candidate = next ?? fallback;

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }

  return candidate;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const postConfirm = searchParams.get("post_confirm");
  const isRecoveryFlow = type === "recovery";
  const next = sanitizeNextPath(
    searchParams.get("next"),
    isRecoveryFlow ? "/reset-password" : "/"
  );

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?tab=signin`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (!error) {
    if (postConfirm === "signin") {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?tab=signin&emailConfirmed=1`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  const errorUrl = new URL(`${origin}/login`);
  errorUrl.searchParams.set("tab", "signin");
  errorUrl.searchParams.set("authCallbackError", error.message);
  return NextResponse.redirect(errorUrl);
}
