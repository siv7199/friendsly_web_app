import type { SupabaseClient } from "@supabase/supabase-js";

export async function isCreatorUser(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role !== "creator") return false;

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return Boolean(creatorProfile);
}

export async function requireCreatorUser(supabase: SupabaseClient, userId: string) {
  const allowed = await isCreatorUser(supabase, userId);
  if (!allowed) {
    throw new Error("CREATOR_REQUIRED");
  }
}

export async function isFanUser(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  return profile?.role === "fan";
}

export async function requireFanUser(supabase: SupabaseClient, userId: string) {
  const allowed = await isFanUser(supabase, userId);
  if (!allowed) {
    throw new Error("FAN_REQUIRED");
  }
}
