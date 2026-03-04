import { isOwnerAccessEmail } from "@/lib/auth/owner-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { readSelectedStoreSlugFromCookies, resolveActiveStoreFromList, type AccessibleStore } from "@/lib/stores/tenant-context";
import type {
  StoreRecord,
  StoreBrandingRecord,
  StoreSettingsRecord,
  StoreContentBlockRecord,
  StoreMemberRole
} from "@/types/database";

export type OwnedStoreBundle = {
  store: Pick<StoreRecord, "id" | "name" | "slug" | "status" | "stripe_account_id">;
  role: StoreMemberRole | "support";
  availableStores: AccessibleStore[];
  branding: Pick<StoreBrandingRecord, "logo_path" | "primary_color" | "accent_color" | "theme_json"> | null;
  settings: Pick<
    StoreSettingsRecord,
    | "support_email"
    | "fulfillment_message"
    | "shipping_policy"
    | "return_policy"
    | "announcement"
    | "footer_tagline"
    | "footer_note"
    | "instagram_url"
    | "facebook_url"
    | "tiktok_url"
    | "policy_faqs"
    | "about_article_html"
    | "about_sections"
    | "storefront_copy_json"
    | "email_capture_enabled"
    | "email_capture_heading"
    | "email_capture_description"
    | "email_capture_success_message"
    | "checkout_enable_local_pickup"
    | "checkout_local_pickup_label"
    | "checkout_local_pickup_fee_cents"
    | "checkout_enable_flat_rate_shipping"
    | "checkout_flat_rate_shipping_label"
    | "checkout_flat_rate_shipping_fee_cents"
    | "checkout_allow_order_note"
    | "checkout_order_note_prompt"
  > | null;
  contentBlocks: Array<
    Pick<StoreContentBlockRecord, "id" | "sort_order" | "eyebrow" | "title" | "body" | "cta_label" | "cta_url" | "is_active">
  >;
};

type MembershipStoreRow = {
  role: StoreMemberRole;
  status: string;
  store: Pick<StoreRecord, "id" | "name" | "slug" | "status" | "stripe_account_id"> | null;
};

async function resolveAccessibleStores(userId: string): Promise<AccessibleStore[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("store_memberships")
    .select("role,status,store:stores!inner(id,name,slug,status,stripe_account_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipStoreRow[]>();

  if (membershipsError && !isMissingRelationInSchemaCache(membershipsError)) {
    throw new Error(membershipsError.message);
  }

  const membershipStores = membershipsError
    ? []
    : (memberships ?? [])
        .filter((entry) => entry.store)
        .map((entry) => ({
          ...entry.store!,
          role: entry.role
        }));

  if (membershipsError && isMissingRelationInSchemaCache(membershipsError)) {
    const { data: ownedStores, error: ownedStoresError } = await supabase
      .from("stores")
      .select("id,name,slug,status,stripe_account_id")
      .eq("owner_user_id", userId)
      .order("name", { ascending: true });

    if (ownedStoresError) {
      throw new Error(ownedStoresError.message);
    }

    if ((ownedStores ?? []).length > 0) {
      return (ownedStores ?? []).map((store) => ({ ...store, role: "owner" as const }));
    }
  }

  if (membershipStores.length > 0) {
    return membershipStores.sort((a, b) => a.name.localeCompare(b.name));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isOwnerAccessEmail(user?.email)) {
    return [];
  }

  const { data: allowlistedStores, error: allowlistedStoresError } = await supabase
    .from("stores")
    .select("id,name,slug,status,stripe_account_id")
    .order("name", { ascending: true });

  if (allowlistedStoresError) {
    throw new Error(allowlistedStoresError.message);
  }

  return (allowlistedStores ?? []).map((store) => ({ ...store, role: "support" as const }));
}

export async function getOwnedStoreBundle(userId: string): Promise<OwnedStoreBundle | null> {
  const supabase = await createSupabaseServerClient();
  const accessibleStores = await resolveAccessibleStores(userId);
  const selectedStoreSlug = await readSelectedStoreSlugFromCookies();
  const resolvedStore = resolveActiveStoreFromList(accessibleStores, selectedStoreSlug);

  if (!resolvedStore) {
    return null;
  }

  const [
    { data: branding, error: brandingError },
    { data: settings, error: settingsError },
    { data: contentBlocks, error: contentBlocksError }
  ] = await Promise.all([
    supabase
      .from("store_branding")
      .select("logo_path,primary_color,accent_color,theme_json")
      .eq("store_id", resolvedStore.id)
      .maybeSingle(),
    supabase
      .from("store_settings")
      .select(
        "support_email,fulfillment_message,shipping_policy,return_policy,announcement,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt"
      )
      .eq("store_id", resolvedStore.id)
      .maybeSingle(),
    supabase
      .from("store_content_blocks")
      .select("id,sort_order,eyebrow,title,body,cta_label,cta_url,is_active")
      .eq("store_id", resolvedStore.id)
      .order("sort_order", { ascending: true })
  ]);

  if (brandingError) {
    throw new Error(brandingError.message);
  }

  if (settingsError && !isMissingRelationInSchemaCache(settingsError)) {
    throw new Error(settingsError.message);
  }

  if (contentBlocksError && !isMissingRelationInSchemaCache(contentBlocksError)) {
    throw new Error(contentBlocksError.message);
  }

  if (settingsError && isMissingRelationInSchemaCache(settingsError)) {
    console.warn("store_settings relation missing in schema cache; continuing with default store settings.");
  }

  if (contentBlocksError && isMissingRelationInSchemaCache(contentBlocksError)) {
    console.warn("store_content_blocks relation missing in schema cache; continuing with empty content blocks.");
  }

  return {
    store: resolvedStore,
    role: resolvedStore.role,
    availableStores: accessibleStores,
    branding,
    settings: settingsError ? null : settings,
    contentBlocks: contentBlocks ?? []
  };
}

export async function getOwnedStoreId(userId: string): Promise<string | null> {
  const bundle = await getOwnedStoreBundle(userId);
  return bundle?.store.id ?? null;
}
