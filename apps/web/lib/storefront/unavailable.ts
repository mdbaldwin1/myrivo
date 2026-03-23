import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveStoreSlugForServerRender } from "@/lib/stores/active-store";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import type { StorefrontBranding, StorefrontSettings, StorefrontStore, StorefrontViewer } from "@/lib/storefront/runtime";

export type StorefrontUnavailableKind = "coming_soon" | "offline";

export type StorefrontUnavailableData = {
  kind: StorefrontUnavailableKind;
  store: StorefrontStore;
  viewer: StorefrontViewer;
  branding: StorefrontBranding;
  settings: StorefrontSettings;
};

function mapUnavailableKind(
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "offline"
): StorefrontUnavailableKind {
  return status === "offline" ? "offline" : "coming_soon";
}

export async function loadStorefrontUnavailableData(explicitStoreSlug?: string | null): Promise<StorefrontUnavailableData | null> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const whiteLabelStoreSlug = await resolveStoreSlugFromDomain(host, { includeNonPublic: true });
  const singleStoreSlug = await resolveStoreSlugForServerRender(explicitStoreSlug ?? whiteLabelStoreSlug);
  if (!singleStoreSlug) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,status,owner_user_id")
    .eq("slug", singleStoreSlug)
    .maybeSingle<{
      id: string;
      name: string;
      slug: string;
      status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
      owner_user_id: string | null;
    }>();

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (!store || store.status === "live" || store.status === "suspended" || store.status === "removed") {
    return null;
  }

  const isOwnerPreview = Boolean(user && user.id === store.owner_user_id);
  let canManageStore = false;
  if (isOwnerPreview) {
    canManageStore = true;
  } else if (user) {
    const { data: membership } = await admin
      .from("store_memberships")
      .select("role,status")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle<{ role: "customer" | "staff" | "admin" | "owner"; status: "active" | "inactive" | "invited" }>();

    if (membership && (membership.role === "staff" || membership.role === "admin" || membership.role === "owner")) {
      canManageStore = true;
    }
  }

  const [{ data: branding, error: brandingError }, { data: settings, error: settingsError }] = await Promise.all([
    admin
      .from("store_branding")
      .select("logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path,primary_color,accent_color,theme_json")
      .eq("store_id", store.id)
      .maybeSingle<StorefrontBranding>(),
    admin
      .from("store_settings")
      .select("support_email,announcement,seo_title,seo_description,storefront_copy_json,footer_tagline,footer_note")
      .eq("store_id", store.id)
      .maybeSingle<StorefrontSettings>()
  ]);

  if (brandingError) {
    throw new Error(brandingError.message);
  }

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  return {
    kind: mapUnavailableKind(store.status),
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug
    },
    viewer: {
      isAuthenticated: Boolean(user),
      canManageStore
    },
    branding,
    settings
  };
}
