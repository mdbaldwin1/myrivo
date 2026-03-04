import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
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

const storeRoleOrder: Record<StoreMemberRole | "support", number> = {
  customer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
  support: 4
};

const globalRoleOrder: Record<GlobalUserRole, number> = {
  user: 0,
  support: 1,
  admin: 2
};

function hasStoreRole(currentRole: StoreMemberRole | "support", requiredRole: StoreMemberRole | "support") {
  return storeRoleOrder[currentRole] >= storeRoleOrder[requiredRole];
}

function hasGlobalRole(currentRole: GlobalUserRole, requiredRole: GlobalUserRole) {
  return globalRoleOrder[currentRole] >= globalRoleOrder[requiredRole];
}

export async function requireStoreRole(requiredRole: StoreMemberRole | "support"): Promise<AuthorizationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const bundle = await getOwnedStoreBundle(user.id);
  if (!bundle) {
    return { context: null, response: NextResponse.json({ error: "Store access denied" }, { status: 403 }) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();

  const globalRole = profile?.global_role ?? "user";
  if (!hasStoreRole(bundle.role, requiredRole)) {
    return { context: null, response: NextResponse.json({ error: "Insufficient store role" }, { status: 403 }) };
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
