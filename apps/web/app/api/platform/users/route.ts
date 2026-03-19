import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  global_role: "user" | "support" | "admin";
  created_at: string;
};

type MembershipRow = {
  user_id: string;
  role: "owner" | "staff" | "customer";
  status: "active" | "suspended";
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [
    { data: users, error: usersError },
    { data: memberships, error: membershipsError },
    { count: usersTotal, error: usersTotalError },
    { count: adminUsersCount, error: adminUsersError },
    { count: supportUsersCount, error: supportUsersError },
    { count: regularUsersCount, error: regularUsersError }
  ] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id,email,display_name,global_role,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<UserRow[]>(),
    admin.from("store_memberships").select("user_id,role,status").returns<MembershipRow[]>(),
    admin.from("user_profiles").select("id", { count: "exact", head: true }),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "admin"),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "support"),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "user")
  ]);

  const aggregateError = usersError ?? membershipsError ?? usersTotalError ?? adminUsersError ?? supportUsersError ?? regularUsersError;
  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const activeStoreCountByUserId = new Map<string, number>();
  const ownerStoreCountByUserId = new Map<string, number>();

  for (const membership of memberships ?? []) {
    if (membership.status === "active") {
      activeStoreCountByUserId.set(membership.user_id, (activeStoreCountByUserId.get(membership.user_id) ?? 0) + 1);
    }
    if (membership.status === "active" && membership.role === "owner") {
      ownerStoreCountByUserId.set(membership.user_id, (ownerStoreCountByUserId.get(membership.user_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      usersTotal: usersTotal ?? 0,
      userRoleCounts: {
        admin: adminUsersCount ?? 0,
        support: supportUsersCount ?? 0,
        user: regularUsersCount ?? 0
      }
    },
    users: (users ?? []).map((user) => ({
      ...user,
      activeStoreCount: activeStoreCountByUserId.get(user.id) ?? 0,
      ownerStoreCount: ownerStoreCountByUserId.get(user.id) ?? 0
    }))
  });
}
