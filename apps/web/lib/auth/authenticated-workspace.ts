import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";

const MANAGEABLE_STORE_ROLES = ["owner", "admin", "staff"] as const;

export async function resolveAuthenticatedWorkspacePath(userId: string): Promise<"/dashboard" | "/account"> {
  const supabase = await createSupabaseServerClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("store_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", [...MANAGEABLE_STORE_ROLES])
    .limit(1);

  if (!membershipsError && (memberships ?? []).length > 0) {
    return "/dashboard";
  }

  if (membershipsError && !isMissingRelationInSchemaCache(membershipsError)) {
    throw new Error(membershipsError.message);
  }

  const { data: ownedStores, error: ownedStoresError } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1);

  if (ownedStoresError) {
    throw new Error(ownedStoresError.message);
  }

  return (ownedStores ?? []).length > 0 ? "/dashboard" : "/account";
}
