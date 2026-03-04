import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "suspended";
  mode: "sandbox" | "live";
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
  const [{ data: stores, error: storesError }, { data: users, error: usersError }] = await Promise.all([
    admin
      .from("stores")
      .select("id,name,slug,status,mode,created_at")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<StoreRow[]>(),
    admin
      .from("user_profiles")
      .select("id,email,display_name,global_role,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<UserRow[]>()
  ]);

  if (storesError) {
    return NextResponse.json({ error: storesError.message }, { status: 500 });
  }

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const storeStatusCounts = (stores ?? []).reduce<Record<string, number>>((acc, store) => {
    acc[store.status] = (acc[store.status] ?? 0) + 1;
    return acc;
  }, {});
  const modeCounts = (stores ?? []).reduce<Record<string, number>>((acc, store) => {
    acc[store.mode] = (acc[store.mode] ?? 0) + 1;
    return acc;
  }, {});
  const userRoleCounts = (users ?? []).reduce<Record<string, number>>((acc, profile) => {
    acc[profile.global_role] = (acc[profile.global_role] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      storeStatusCounts,
      modeCounts,
      userRoleCounts
    },
    stores: stores ?? [],
    users: users ?? []
  });
}

