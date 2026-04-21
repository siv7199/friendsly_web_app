import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeCreatorSlug } from "@/lib/routes";

export default async function MobileCreatorLiveRedirectPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=/m/live");
  }

  const metaUsername = (user.user_metadata?.username ?? null) as string | null;
  let slug = normalizeCreatorSlug(metaUsername);

  if (!slug) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    slug = normalizeCreatorSlug(profile?.username ?? null);
  }

  redirect(`/m/live/${slug ?? user.id}`);
}
