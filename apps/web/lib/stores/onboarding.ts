import { hasStoreRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingStoreRole = "owner" | "admin" | "staff" | "customer";

export type StoreOnboardingProgress = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "active" | "suspended";
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
    status: "draft" | "pending_review" | "active" | "suspended";
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
  status: "draft" | "pending_review" | "active" | "suspended";
  stripe_account_id: string | null;
  role: OnboardingStoreRole;
};

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
  const launch = store.status === "active";
  const launchReady = profile && brand && firstProduct && payments;
  const completedStepCount = [profile, brand, firstProduct, payments, launch].filter(Boolean).length;

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
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
  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("store_memberships")
    .select("role,store:stores!inner(id,name,slug,status,stripe_account_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipStoreRow[]>();

  const stores = (memberships ?? [])
    .filter((membership) => membership.store)
    .map((membership) => ({
      ...membership.store!,
      role: membership.role
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (stores.length === 0) {
    return [];
  }

  const storeIds = stores.map((store) => store.id);

  const [{ data: settingsRows }, { data: brandingRows }] = await Promise.all([
    supabase.from("store_settings").select("store_id,support_email").in("store_id", storeIds).returns<SettingsRow[]>(),
    supabase.from("store_branding").select("store_id,logo_path,primary_color,accent_color").in("store_id", storeIds).returns<BrandingRow[]>()
  ]);

  const hasProductByStoreId = new Map<string, boolean>();
  await Promise.all(
    storeIds.map(async (storeId) => {
      const { data } = await supabase.from("products").select("id").eq("store_id", storeId).limit(1);
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

  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("store_memberships")
    .select("role,store:stores!inner(id,name,slug,status,stripe_account_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipStoreRow[]>();

  const targetStore = (memberships ?? [])
    .filter((membership) => membership.store)
    .map((membership) => ({ ...membership.store!, role: membership.role }))
    .find((store) => store.slug === normalizedSlug);

  if (!targetStore) {
    return null;
  }

  const [{ data: settings }, { data: branding }, { data: products }] = await Promise.all([
    supabase.from("store_settings").select("store_id,support_email").eq("store_id", targetStore.id).maybeSingle<SettingsRow>(),
    supabase.from("store_branding").select("store_id,logo_path,primary_color,accent_color").eq("store_id", targetStore.id).maybeSingle<BrandingRow>(),
    supabase.from("products").select("id").eq("store_id", targetStore.id).limit(1)
  ]);

  return buildProgress(targetStore, settings ?? undefined, branding ?? undefined, Boolean((products ?? []).length));
}
