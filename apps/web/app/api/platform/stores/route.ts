import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { formatBillingPlanLabel, type BillingPlanOption, type BillingPlanSummary } from "@/lib/billing/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreStatus = "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";

type StoreRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  white_label_enabled: boolean;
  stripe_account_id: string | null;
  created_at: string;
};

type OwnerRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type MembershipRow = {
  store_id: string;
  status: "active" | "invited" | "suspended";
};

type StoreBillingProfileRow = {
  store_id: string;
  billing_plan_id: string | null;
  billing_plans: BillingPlanSummary | BillingPlanSummary[] | null;
};

function normalizeBillingPlan(raw: StoreBillingProfileRow["billing_plans"]): BillingPlanSummary | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  return {
    key: value.key,
    name: value.name ?? formatBillingPlanLabel(value.key),
    transaction_fee_bps: value.transaction_fee_bps,
    transaction_fee_fixed_cents: value.transaction_fee_fixed_cents
  };
}

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [
    { data: stores, error: storesError },
    { count: storesTotal, error: storesTotalError },
    { count: liveStoresCount, error: liveStoresError },
    { count: pendingStoresCount, error: pendingStoresError },
    { count: suspendedStoresCount, error: suspendedStoresError },
    { count: offlineStoresCount, error: offlineStoresError }
  ] = await Promise.all([
    admin
      .from("stores")
      .select("id,owner_user_id,name,slug,status,white_label_enabled,stripe_account_id,created_at")
      .order("created_at", { ascending: false })
      .limit(250)
      .returns<StoreRow[]>(),
    admin.from("stores").select("id", { count: "exact", head: true }),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "live"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    admin.from("stores").select("id", { count: "exact", head: true }).eq("status", "offline")
  ]);

  if (storesError) {
    return NextResponse.json({ error: storesError.message }, { status: 500 });
  }

  const aggregateError = storesTotalError ?? liveStoresError ?? pendingStoresError ?? suspendedStoresError ?? offlineStoresError;
  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const ownerIds = Array.from(new Set((stores ?? []).map((store) => store.owner_user_id).filter(Boolean)));
  const storeIds = (stores ?? []).map((store) => store.id);

  const [{ data: owners, error: ownersError }, { data: memberships, error: membershipsError }, { data: billingProfiles, error: billingProfilesError }, { data: plans, error: plansError }] = await Promise.all([
    ownerIds.length
      ? admin.from("user_profiles").select("id,email,display_name").in("id", ownerIds).returns<OwnerRow[]>()
      : Promise.resolve({ data: [] as OwnerRow[], error: null }),
    storeIds.length
      ? admin
          .from("store_memberships")
          .select("store_id,status")
          .in("store_id", storeIds)
          .returns<MembershipRow[]>()
      : Promise.resolve({ data: [] as MembershipRow[], error: null }),
    storeIds.length
      ? admin
          .from("store_billing_profiles")
          .select("store_id,billing_plan_id,billing_plans(key,name,transaction_fee_bps,transaction_fee_fixed_cents)")
          .in("store_id", storeIds)
          .returns<StoreBillingProfileRow[]>()
      : Promise.resolve({ data: [] as StoreBillingProfileRow[], error: null }),
    admin
      .from("billing_plans")
      .select("id,key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents,active")
      .eq("active", true)
      .order("monthly_price_cents", { ascending: true })
      .returns<BillingPlanOption[]>()
  ]);

  if (ownersError) {
    return NextResponse.json({ error: ownersError.message }, { status: 500 });
  }

  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 500 });
  }

  if (billingProfilesError) {
    return NextResponse.json({ error: billingProfilesError.message }, { status: 500 });
  }

  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  const ownerById = new Map((owners ?? []).map((owner) => [owner.id, owner]));
  const activeMemberCountByStoreId = new Map<string, number>();
  const billingPlanByStoreId = new Map<string, BillingPlanSummary>();
  const defaultPlan = (plans ?? []).find((plan) => plan.key === "standard") ?? (plans ?? [])[0] ?? null;

  for (const membership of memberships ?? []) {
    if (membership.status !== "active") {
      continue;
    }
    activeMemberCountByStoreId.set(membership.store_id, (activeMemberCountByStoreId.get(membership.store_id) ?? 0) + 1);
  }

  for (const billingProfile of billingProfiles ?? []) {
    const billingPlan = normalizeBillingPlan(billingProfile.billing_plans);
    if (!billingPlan) {
      continue;
    }
    billingPlanByStoreId.set(billingProfile.store_id, billingPlan);
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      storesTotal: storesTotal ?? 0,
      liveStoresCount: liveStoresCount ?? 0,
      pendingStoresCount: pendingStoresCount ?? 0,
      suspendedStoresCount: suspendedStoresCount ?? 0,
      offlineStoresCount: offlineStoresCount ?? 0
    },
    plans: plans ?? [],
    stores: (stores ?? []).map((store) => {
      const owner = ownerById.get(store.owner_user_id);
      const billingPlan =
        billingPlanByStoreId.get(store.id) ??
        (defaultPlan
          ? {
              key: defaultPlan.key,
              name: defaultPlan.name,
              transaction_fee_bps: defaultPlan.transaction_fee_bps,
              transaction_fee_fixed_cents: defaultPlan.transaction_fee_fixed_cents
            }
          : null);
      return {
        ...store,
        activeMemberCount: activeMemberCountByStoreId.get(store.id) ?? 0,
        billingPlan,
        owner: {
          id: store.owner_user_id,
          email: owner?.email ?? null,
          display_name: owner?.display_name ?? null
        }
      };
    })
  });
}
