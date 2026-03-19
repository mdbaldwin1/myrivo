import { hasStoreRole } from "@/lib/auth/roles";
import { hasStoreLaunchedOnce, isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OnboardingStoreRole = "owner" | "admin" | "staff" | "customer";

export type StoreOnboardingProgress = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
  hasLaunchedOnce: boolean;
  statusReasonCode?: string | null;
  statusReasonDetail?: string | null;
  role: OnboardingStoreRole;
  canManageWorkspace: boolean;
  canLaunch: boolean;
  steps: {
    profile: boolean;
    branding: boolean;
    firstProduct: boolean;
    payments: boolean;
    launch: boolean;
  };
  completedStepCount: number;
  totalStepCount: number;
  launchReady: boolean;
};

type MembershipStoreRow = {
  role: OnboardingStoreRole;
  store: {
    id: string;
    name: string;
    slug: string;
    status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
    has_launched_once: boolean;
    status_reason_code: string | null;
    status_reason_detail: string | null;
    stripe_account_id: string | null;
  } | null;
};

type LegacyMembershipStoreRow = {
  role: OnboardingStoreRole;
  store: {
    id: string;
    name: string;
    slug: string;
    status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
    status_reason_code: string | null;
    status_reason_detail: string | null;
    stripe_account_id: string | null;
  } | null;
};

type SettingsRow = {
  store_id: string;
  support_email: string | null;
};

type BrandingRow = {
  store_id: string;
  logo_path: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

type ProgressSourceStore = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
  has_launched_once: boolean;
  status_reason_code: string | null;
  status_reason_detail: string | null;
  stripe_account_id: string | null;
  role: OnboardingStoreRole;
};

function withLaunchHistory<T extends { status: ProgressSourceStore["status"] }>(
  store: T & { has_launched_once?: boolean | null }
): T & { has_launched_once: boolean } {
  return {
    ...store,
    has_launched_once: hasStoreLaunchedOnce(store.status, store.has_launched_once ?? null)
  };
}

async function resolveOwnedProgressStores(
  userId: string
): Promise<ProgressSourceStore[]> {
  const admin = createSupabaseAdminClient();
  const initialResult = await admin
    .from("stores")
    .select("id,name,slug,status,has_launched_once,status_reason_code,status_reason_detail,stripe_account_id")
    .eq("owner_user_id", userId)
    .order("name", { ascending: true });

  let stores = initialResult.data ?? [];

  if (initialResult.error && isMissingColumnInSchemaCache(initialResult.error, "has_launched_once")) {
    const legacyResult = await admin
      .from("stores")
      .select("id,name,slug,status,status_reason_code,status_reason_detail,stripe_account_id")
      .eq("owner_user_id", userId)
      .order("name", { ascending: true });

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }

    stores = (legacyResult.data ?? []).map((store) => withLaunchHistory(store));
  } else if (initialResult.error) {
    throw new Error(initialResult.error.message);
  }

  return stores.map((store) => ({ ...store, role: "owner" as const }));
}

function hasProfileBasics(storeName: string, supportEmail: string | null | undefined): boolean {
  return storeName.trim().length >= 2 && Boolean(supportEmail?.includes("@"));
}

function hasBrandBasics(branding: BrandingRow | undefined): boolean {
  if (!branding) {
    return false;
  }
  return Boolean(branding.primary_color || branding.accent_color);
}

function buildProgress(
  store: ProgressSourceStore,
  settings: SettingsRow | undefined,
  branding: BrandingRow | undefined,
  hasProduct: boolean
): StoreOnboardingProgress {
  const profile = hasProfileBasics(store.name, settings?.support_email);
  const brand = hasBrandBasics(branding);
  const firstProduct = hasProduct;
  const payments = Boolean(store.stripe_account_id);
  const launch = isStorePubliclyAccessibleStatus(store.status);
  const launchReady = profile && brand && firstProduct && payments;
  const completedStepCount = [profile, brand, firstProduct, payments, launch].filter(Boolean).length;

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    hasLaunchedOnce: store.has_launched_once,
    statusReasonCode: store.status_reason_code,
    statusReasonDetail: store.status_reason_detail,
    role: store.role,
    canManageWorkspace: hasStoreRole(store.role, "staff"),
    canLaunch: hasStoreRole(store.role, "admin"),
    steps: {
      profile,
      branding: brand,
      firstProduct,
      payments,
      launch
    },
    completedStepCount,
    totalStepCount: 5,
    launchReady
  };
}

export async function getStoreOnboardingProgressForUser(userId: string): Promise<StoreOnboardingProgress[]> {
  const admin = createSupabaseAdminClient();
  const initialResult = await admin
    .from("store_memberships")
    .select("role,store:stores!inner(id,name,slug,status,has_launched_once,status_reason_code,status_reason_detail,stripe_account_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipStoreRow[]>();

  let memberships = initialResult.data ?? [];

  if (initialResult.error && isMissingColumnInSchemaCache(initialResult.error, "has_launched_once")) {
    const legacyResult = await admin
      .from("store_memberships")
      .select("role,store:stores!inner(id,name,slug,status,status_reason_code,status_reason_detail,stripe_account_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .returns<LegacyMembershipStoreRow[]>();

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }

    memberships = (legacyResult.data ?? []).map((membership) => ({
      ...membership,
      store: membership.store ? withLaunchHistory(membership.store) : null
    }));
  } else if (initialResult.error) {
    throw new Error(initialResult.error.message);
  }

  const membershipStores = (memberships ?? [])
    .filter((membership) => membership.store)
    .map((membership) => ({
      ...membership.store!,
      role: membership.role
    }));

  const storesById = new Map<string, ProgressSourceStore>();
  for (const store of membershipStores) {
    storesById.set(store.id, store);
  }
  for (const store of await resolveOwnedProgressStores(userId)) {
    storesById.set(store.id, store);
  }

  const stores = Array.from(storesById.values()).sort((a, b) => a.name.localeCompare(b.name));

  if (stores.length === 0) {
    return [];
  }

  const storeIds = stores.map((store) => store.id);

  const [{ data: settingsRows }, { data: brandingRows }] = await Promise.all([
    admin.from("store_settings").select("store_id,support_email").in("store_id", storeIds).returns<SettingsRow[]>(),
    admin.from("store_branding").select("store_id,logo_path,primary_color,accent_color").in("store_id", storeIds).returns<BrandingRow[]>()
  ]);

  const hasProductByStoreId = new Map<string, boolean>();
  await Promise.all(
    storeIds.map(async (storeId) => {
      const { data } = await admin.from("products").select("id").eq("store_id", storeId).limit(1);
      hasProductByStoreId.set(storeId, Boolean((data ?? []).length));
    })
  );

  const settingsByStoreId = new Map((settingsRows ?? []).map((row) => [row.store_id, row]));
  const brandingByStoreId = new Map((brandingRows ?? []).map((row) => [row.store_id, row]));

  return stores.map((store) =>
    buildProgress(store, settingsByStoreId.get(store.id), brandingByStoreId.get(store.id), hasProductByStoreId.get(store.id) ?? false)
  );
}

export async function getStoreOnboardingProgressForStore(userId: string, storeSlug: string): Promise<StoreOnboardingProgress | null> {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const initialResult = await admin
    .from("store_memberships")
    .select("role,store:stores!inner(id,name,slug,status,has_launched_once,status_reason_code,status_reason_detail,stripe_account_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipStoreRow[]>();

  let memberships = initialResult.data ?? [];

  if (initialResult.error && isMissingColumnInSchemaCache(initialResult.error, "has_launched_once")) {
    const legacyResult = await admin
      .from("store_memberships")
      .select("role,store:stores!inner(id,name,slug,status,status_reason_code,status_reason_detail,stripe_account_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .returns<LegacyMembershipStoreRow[]>();

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }

    memberships = (legacyResult.data ?? []).map((membership) => ({
      ...membership,
      store: membership.store ? withLaunchHistory(membership.store) : null
    }));
  } else if (initialResult.error) {
    throw new Error(initialResult.error.message);
  }

  const membershipStores = (memberships ?? [])
    .filter((membership) => membership.store)
    .map((membership) => ({ ...membership.store!, role: membership.role }));

  const storesBySlug = new Map<string, ProgressSourceStore>();
  for (const store of membershipStores) {
    storesBySlug.set(store.slug, store);
  }
  for (const store of await resolveOwnedProgressStores(userId)) {
    storesBySlug.set(store.slug, store);
  }

  const targetStore = storesBySlug.get(normalizedSlug) ?? null;

  if (!targetStore) {
    return null;
  }

  const [{ data: settings }, { data: branding }, { data: products }] = await Promise.all([
    admin.from("store_settings").select("store_id,support_email").eq("store_id", targetStore.id).maybeSingle<SettingsRow>(),
    admin.from("store_branding").select("store_id,logo_path,primary_color,accent_color").eq("store_id", targetStore.id).maybeSingle<BrandingRow>(),
    admin.from("products").select("id").eq("store_id", targetStore.id).limit(1)
  ]);

  return buildProgress(targetStore, settings ?? undefined, branding ?? undefined, Boolean((products ?? []).length));
}
