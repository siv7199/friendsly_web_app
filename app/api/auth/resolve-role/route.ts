import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/resolve-role
 *
 * Called after login when a user has no role. Checks if they have an approved
 * creator request and, if so, promotes them to creator. Otherwise returns "fan".
 *
 * This handles the case where a creator was approved (either via the review
 * page or manually in the DB) but the profile role wasn't set.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Check if a profile exists — the trigger should have created one on signup
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    // If no profile row exists, create one now (trigger may have failed on username collision)
    if (!profile) {
      const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      const baseUsername = (user.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
      // Add random suffix to avoid unique constraint collision
      const username = `${baseUsername}_${Date.now().toString(36)}`;
      const initials = fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "??";

      await serviceSupabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        username,
        avatar_initials: initials,
        avatar_color: "bg-violet-600",
      });
    }

    // Check for an approved creator signup request
    const { data: approvedRequest } = await serviceSupabase
      .from("creator_signup_requests")
      .select("id, status")
      .eq("email", user.email!)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (approvedRequest) {
      // Promote to creator: set profile role, upsert creator_profiles, update auth metadata
      await serviceSupabase.from("profiles").update({ role: "creator" }).eq("id", user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceSupabase.from("creator_profiles") as any).upsert(
        { id: user.id },
        { onConflict: "id" }
      );
      await serviceSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, role: "creator" },
      });

      return NextResponse.json({ role: "creator", promoted: true });
    }

    // No approved creator request — they're a fan
    return NextResponse.json({ role: "fan", promoted: false });
  } catch (err) {
    console.error("resolve-role: error", err);
    return NextResponse.json({ error: "Could not resolve role." }, { status: 500 });
  }
}
