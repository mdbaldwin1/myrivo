import { NextResponse } from "next/server";
import { hasGlobalRole, hasStorePermission, type StorePermission } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import type { GlobalUserRole, StoreMemberRole } from "@/types/database";

export type AuthorizedStoreContext = {
  userId: string;
  storeId: string;
  storeSlug: string;
  storeRole: StoreMemberRole | "support";
  globalRole: GlobalUserRole;
};

export type AuthorizationResult = {
  context: AuthorizedStoreContext | null;
  response: NextResponse | null;
};

export async function requireStoreRole(
  requiredRole: StoreMemberRole | "support",
  storeSlug?: string | null
): Promise<AuthorizationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, requiredRole);
  if (!bundle) {
    return { context: null, response: NextResponse.json({ error: "Store access denied" }, { status: 403 }) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();

  const globalRole = profile?.global_role ?? "user";
  return {
    context: {
      userId: user.id,
      storeId: bundle.store.id,
      storeSlug: bundle.store.slug,
      storeRole: bundle.role,
      globalRole
    },
    response: null
  };
}

export async function requireStorePermission(permission: StorePermission, storeSlug?: string | null): Promise<AuthorizationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "customer");
  if (!bundle) {
    return { context: null, response: NextResponse.json({ error: "Store access denied" }, { status: 403 }) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();

  const globalRole = profile?.global_role ?? "user";

  if (!hasStorePermission(bundle.role, bundle.permissionsJson, permission)) {
    return { context: null, response: NextResponse.json({ error: "Insufficient store permission" }, { status: 403 }) };
  }

  return {
    context: {
      userId: user.id,
      storeId: bundle.store.id,
      storeSlug: bundle.store.slug,
      storeRole: bundle.role,
      globalRole
    },
    response: null
  };
}

export async function requirePlatformRole(requiredRole: GlobalUserRole): Promise<AuthorizationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();

  const globalRole = profile?.global_role ?? "user";
  if (!hasGlobalRole(globalRole, requiredRole)) {
    return { context: null, response: NextResponse.json({ error: "Insufficient platform role" }, { status: 403 }) };
  }

  return {
    context: {
      userId: user.id,
      storeId: "",
      storeSlug: "",
      storeRole: "customer",
      globalRole
    },
    response: null
  };
}
