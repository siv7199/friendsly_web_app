/**
 * app/auth/callback/route.ts
 *
 * Supabase redirects here after email confirmation and OAuth.
 * Exchanges the one-time code for a session, then routes the user onward.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function isRecoverableManualSigninPkceError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    message.includes("pkce code verifier not found in storage") ||
    message.includes("flow_state_not_found") ||
    message.includes("flow state not found") ||
    message.includes("flow_state_expired") ||
    message.includes("flow state expired")
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const postConfirm = searchParams.get("post_confirm");
  const isRecoveryFlow = type === "recovery";
  let next = searchParams.get("next") ?? (isRecoveryFlow ? "/reset-password" : "/");

  // Reject absolute, protocol-relative, and backslash-prefixed paths to
  // prevent open-redirect abuse of the OAuth/verification callback.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    next = "/";
  }

  if (code || (tokenHash && type)) {
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

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: type as EmailOtpType,
        });

    if (!error) {
      if (postConfirm === "signin") {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?tab=signin&emailConfirmed=1`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    // Email-confirmation links in the PKCE flow can still successfully verify
    // the user's email before the final code exchange fails if the link is
    // opened outside the original browser context. In our manual-sign-in flow,
    // we don't need to keep the session from this callback, so treat this case
    // as a successful confirmation and send the user to sign in normally.
    if (postConfirm === "signin" && code && isRecoverableManualSigninPkceError(error)) {
      return NextResponse.redirect(`${origin}/login?tab=signin&emailConfirmed=1`);
    }

    const errorUrl = new URL(`${origin}/login`);
    errorUrl.searchParams.set("tab", "signin");
    errorUrl.searchParams.set("authCallbackError", error.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(`${origin}/login?tab=signin`);
}
