import { hasStoreRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingColumnInSchemaCache, isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
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
  permissionsJson: Record<string, unknown> | null;
  branding: Pick<
    StoreBrandingRecord,
    "logo_path" | "favicon_path" | "apple_touch_icon_path" | "og_image_path" | "twitter_image_path" | "primary_color" | "accent_color" | "theme_json"
  > | null;
  settings: Pick<
    StoreSettingsRecord,
    | "support_email"
    | "fulfillment_message"
    | "shipping_policy"
    | "return_policy"
    | "announcement"
    | "seo_title"
    | "seo_description"
    | "seo_noindex"
    | "seo_location_city"
    | "seo_location_region"
    | "seo_location_state"
    | "seo_location_postal_code"
    | "seo_location_country_code"
    | "seo_location_address_line1"
    | "seo_location_address_line2"
    | "seo_location_show_full_address"
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
    | "welcome_popup_enabled"
    | "welcome_popup_eyebrow"
    | "welcome_popup_headline"
    | "welcome_popup_body"
    | "welcome_popup_email_placeholder"
    | "welcome_popup_cta_label"
    | "welcome_popup_decline_label"
    | "welcome_popup_image_layout"
    | "welcome_popup_delay_seconds"
    | "welcome_popup_dismiss_days"
    | "welcome_popup_image_path"
    | "welcome_popup_promotion_id"
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
  permissions_json: Record<string, unknown> | null;
  store: Pick<StoreRecord, "id" | "name" | "slug" | "status" | "stripe_account_id"> | null;
};

async function resolveAccessibleStores(userId: string): Promise<AccessibleStore[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("store_memberships")
    .select("role,status,permissions_json,store:stores!inner(id,name,slug,status,stripe_account_id)")
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
          role: entry.role,
          permissions_json: entry.permissions_json ?? {}
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
      return (ownedStores ?? []).map((store) => ({ ...store, role: "owner" as const, permissions_json: {} }));
    }
  }

  if (membershipStores.length > 0) {
    return membershipStores.sort((a, b) => a.name.localeCompare(b.name));
  }

  return [];
}

async function buildOwnedStoreBundleFromResolvedStore(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resolvedStore: AccessibleStore,
  accessibleStores: AccessibleStore[]
): Promise<OwnedStoreBundle> {
  const readBranding = async () => {
    const fullResult = await supabase
      .from("store_branding")
      .select("logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path,primary_color,accent_color,theme_json")
      .eq("store_id", resolvedStore.id)
      .maybeSingle();

    if (
      fullResult.error &&
      (isMissingColumnInSchemaCache(fullResult.error, "favicon_path") ||
        isMissingColumnInSchemaCache(fullResult.error, "apple_touch_icon_path") ||
        isMissingColumnInSchemaCache(fullResult.error, "og_image_path") ||
        isMissingColumnInSchemaCache(fullResult.error, "twitter_image_path"))
    ) {
      const fallbackResult = await supabase
        .from("store_branding")
        .select("logo_path,primary_color,accent_color,theme_json")
        .eq("store_id", resolvedStore.id)
        .maybeSingle<{ logo_path: string | null; primary_color: string | null; accent_color: string | null; theme_json: Record<string, unknown> }>();

      if (fallbackResult.error) {
        return fallbackResult;
      }

      return {
        data: fallbackResult.data
          ? {
              ...fallbackResult.data,
              favicon_path: null,
              apple_touch_icon_path: null,
              og_image_path: null,
              twitter_image_path: null
            }
          : null,
        error: null
      };
    }

    return fullResult;
  };

  const [
    { data: branding, error: brandingError },
    { data: settings, error: settingsError },
    { data: contentBlocks, error: contentBlocksError }
  ] = await Promise.all([
    readBranding(),
    (async () => {
      const full = await supabase
        .from("store_settings")
        .select(
          "support_email,fulfillment_message,shipping_policy,return_policy,announcement,seo_title,seo_description,seo_noindex,seo_location_city,seo_location_region,seo_location_state,seo_location_postal_code,seo_location_country_code,seo_location_address_line1,seo_location_address_line2,seo_location_show_full_address,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,welcome_popup_enabled,welcome_popup_eyebrow,welcome_popup_headline,welcome_popup_body,welcome_popup_email_placeholder,welcome_popup_cta_label,welcome_popup_decline_label,welcome_popup_image_layout,welcome_popup_delay_seconds,welcome_popup_dismiss_days,welcome_popup_image_path,welcome_popup_promotion_id,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt"
        )
        .eq("store_id", resolvedStore.id)
        .maybeSingle();

      if (
        isMissingColumnInSchemaCache(full.error, "seo_title") ||
        isMissingColumnInSchemaCache(full.error, "seo_description") ||
        isMissingColumnInSchemaCache(full.error, "seo_noindex") ||
        isMissingColumnInSchemaCache(full.error, "seo_location_city") ||
        isMissingColumnInSchemaCache(full.error, "seo_location_show_full_address") ||
        isMissingColumnInSchemaCache(full.error, "welcome_popup_enabled") ||
        isMissingColumnInSchemaCache(full.error, "welcome_popup_eyebrow") ||
        isMissingColumnInSchemaCache(full.error, "welcome_popup_promotion_id") ||
        isMissingColumnInSchemaCache(full.error, "welcome_popup_decline_label") ||
        isMissingColumnInSchemaCache(full.error, "welcome_popup_image_layout")
      ) {
        const legacy = await supabase
          .from("store_settings")
          .select(
            "support_email,fulfillment_message,shipping_policy,return_policy,announcement,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt"
          )
          .eq("store_id", resolvedStore.id)
          .maybeSingle();

        return {
          data: legacy.data
            ? {
                ...legacy.data,
                seo_title: null,
                seo_description: null,
                seo_noindex: false,
                seo_location_city: null,
                seo_location_region: null,
                seo_location_state: null,
                seo_location_postal_code: null,
                seo_location_country_code: null,
                seo_location_address_line1: null,
                seo_location_address_line2: null,
                seo_location_show_full_address: false,
                welcome_popup_enabled: false,
                welcome_popup_eyebrow: null,
                welcome_popup_headline: null,
                welcome_popup_body: null,
                welcome_popup_email_placeholder: null,
                welcome_popup_cta_label: null,
                welcome_popup_decline_label: null,
                welcome_popup_image_layout: "left",
                welcome_popup_delay_seconds: 6,
                welcome_popup_dismiss_days: 14,
                welcome_popup_image_path: null,
                welcome_popup_promotion_id: null
              }
            : null,
          error: legacy.error
        };
      }

      return full;
    })(),
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
    permissionsJson: resolvedStore.permissions_json ?? {},
    branding,
    settings: settingsError ? null : settings,
    contentBlocks: contentBlocks ?? []
  };
}

export async function getOwnedStoreBundle(
  userId: string,
  requiredRole: StoreMemberRole | "support" = "staff"
): Promise<OwnedStoreBundle | null> {
  const supabase = await createSupabaseServerClient();
  const accessibleStores = await resolveAccessibleStores(userId);
  const selectedStoreSlug = await readSelectedStoreSlugFromCookies();
  const resolvedStore = resolveActiveStoreFromList(accessibleStores, selectedStoreSlug);

  if (!resolvedStore) {
    return null;
  }

  if (!hasStoreRole(resolvedStore.role, requiredRole)) {
    return null;
  }

  return await buildOwnedStoreBundleFromResolvedStore(supabase, resolvedStore, accessibleStores);
}

export async function getOwnedStoreBundleForSlug(
  userId: string,
  storeSlug: string,
  requiredRole: StoreMemberRole | "support" = "staff"
): Promise<OwnedStoreBundle | null> {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const accessibleStores = await resolveAccessibleStores(userId);
  const resolvedStore = accessibleStores.find((store) => store.slug === normalizedSlug);

  if (!resolvedStore) {
    return null;
  }

  if (!hasStoreRole(resolvedStore.role, requiredRole)) {
    return null;
  }

  return await buildOwnedStoreBundleFromResolvedStore(supabase, resolvedStore, accessibleStores);
}

export async function getOwnedStoreBundleForOptionalSlug(
  userId: string,
  storeSlug: string | null | undefined,
  requiredRole: StoreMemberRole | "support" = "staff"
): Promise<OwnedStoreBundle | null> {
  const normalizedSlug = storeSlug?.trim().toLowerCase() ?? "";
  if (normalizedSlug) {
    return getOwnedStoreBundleForSlug(userId, normalizedSlug, requiredRole);
  }

  return getOwnedStoreBundle(userId, requiredRole);
}

export async function getOwnedStoreId(userId: string): Promise<string | null> {
  const bundle = await getOwnedStoreBundle(userId, "staff");
  return bundle?.store.id ?? null;
}
