import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { resolveWelcomeIntent } from "@/lib/auth/welcome-intent";

const MANAGEABLE_STORE_ROLES = ["owner", "admin", "staff"] as const;

type AuthenticatedWorkspacePath = "/dashboard" | "/account" | "/dashboard/welcome" | "/dashboard/stores/onboarding/new";

export async function resolveAuthenticatedWorkspacePath(userId: string): Promise<AuthenticatedWorkspacePath> {
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("email,metadata")
    .eq("id", userId)
    .maybeSingle<{ email: string | null; metadata: Record<string, unknown> | null }>();

  if (profileError && !isMissingRelationInSchemaCache(profileError)) {
    throw new Error(profileError.message);
  }

  const welcomeIntent = resolveWelcomeIntent(profile?.metadata);

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

  if ((ownedStores ?? []).length > 0) {
    return "/dashboard";
  }

  if (welcomeIntent === "sell") {
    return "/dashboard/stores/onboarding/new";
  }

  if (welcomeIntent === "shop") {
    return "/dashboard";
  }

  const [{ count: cartCount, error: cartError }, { count: orderCount, error: orderError }, { count: savedStoreCount, error: savedStoreError }] = await Promise.all([
    supabase.from("customer_carts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_email", profile?.email ?? ""),
    supabase.from("customer_saved_stores").select("id", { count: "exact", head: true }).eq("user_id", userId)
  ]);

  if (cartError) {
    throw new Error(cartError.message);
  }

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (savedStoreError) {
    throw new Error(savedStoreError.message);
  }

  return (cartCount ?? 0) > 0 || (orderCount ?? 0) > 0 || (savedStoreCount ?? 0) > 0 ? "/dashboard" : "/dashboard/welcome";
}
