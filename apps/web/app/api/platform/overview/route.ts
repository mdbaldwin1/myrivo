import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
  created_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  global_role: "user" | "support" | "admin";
  created_at: string;
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [
    { data: stores, error: storesError },
    { data: users, error: usersError },
    { count: storesTotal, error: storesTotalError },
    { count: liveStoresCount, error: liveStoresError },
    { count: pendingStoresCount, error: pendingStoresError },
    { count: draftStoresCount, error: draftStoresError },
    { count: suspendedStoresCount, error: suspendedStoresError },
    { count: offlineStoresCount, error: offlineStoresError },
    { count: usersTotal, error: usersTotalError },
    { count: adminUsersCount, error: adminUsersError },
    { count: supportUsersCount, error: supportUsersError },
    { count: regularUsersCount, error: regularUsersError },
    { count: pendingReviewsCount, error: pendingReviewsError }
  ] = await Promise.all([
    admin
      .from("stores")
      .select("id,name,slug,status,created_at")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<StoreRow[]>(),
    admin
      .from("user_profiles")
      .select("id,email,display_name,global_role,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<UserRow[]>(),
    admin.from("stores").select("id", { count: "exact", head: true }),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "live"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "offline"),
    admin.from("user_profiles").select("id", { count: "exact", head: true }),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "admin"),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "support"),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("global_role", "user"),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending")
  ]);

  if (storesError) {
    return NextResponse.json({ error: storesError.message }, { status: 500 });
  }

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const aggregateError =
    storesTotalError ??
    liveStoresError ??
    pendingStoresError ??
    draftStoresError ??
    suspendedStoresError ??
    offlineStoresError ??
    usersTotalError ??
    adminUsersError ??
    supportUsersError ??
    regularUsersError ??
    pendingReviewsError;

  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      storesTotal: storesTotal ?? 0,
      usersTotal: usersTotal ?? 0,
      pendingReviewsCount: pendingReviewsCount ?? 0,
      storeStatusCounts: {
        live: liveStoresCount ?? 0,
        pending_review: pendingStoresCount ?? 0,
        draft: draftStoresCount ?? 0,
        suspended: suspendedStoresCount ?? 0,
        offline: offlineStoresCount ?? 0
      },
      userRoleCounts: {
        admin: adminUsersCount ?? 0,
        support: supportUsersCount ?? 0,
        user: regularUsersCount ?? 0
      }
    },
    stores: stores ?? [],
    users: users ?? []
  });
}
