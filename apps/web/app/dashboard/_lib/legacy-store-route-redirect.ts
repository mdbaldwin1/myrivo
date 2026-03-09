import { redirect } from "next/navigation";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function redirectToActiveStoreWorkspace(targetPath: string) {
  const normalizedTargetPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    redirect("/dashboard/stores");
  }

  redirect(`/dashboard/stores/${bundle.store.slug}${normalizedTargetPath}`);
}
