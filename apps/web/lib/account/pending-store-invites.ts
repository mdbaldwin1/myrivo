import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardHomePendingInvite } from "@/lib/dashboard/home/dashboard-home-types";

type PendingInviteRow = {
  id: string;
  store_id: string;
  role: "admin" | "staff";
  expires_at: string;
  stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getPendingStoreInvitesByEmail(supabase: SupabaseClient, email: string | null | undefined): Promise<DashboardHomePendingInvite[]> {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from("store_membership_invites")
    .select("id,store_id,role,expires_at,stores!inner(id,name,slug)")
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .returns<PendingInviteRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((invite) => {
      const store = firstRelation(invite.stores);
      if (!store) {
        return null;
      }

      return {
        id: invite.id,
        storeId: invite.store_id,
        storeName: store.name,
        storeSlug: store.slug,
        role: invite.role,
        expiresAt: invite.expires_at
      };
    })
    .filter((invite): invite is NonNullable<typeof invite> => Boolean(invite));
}
