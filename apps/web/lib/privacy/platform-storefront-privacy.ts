import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformStorefrontPrivacySettingsRecord } from "@/types/database";

export type ResolvedPlatformStorefrontPrivacySettings = {
  noticeAtCollectionEnabled: boolean;
  checkoutNoticeEnabled: boolean;
  newsletterNoticeEnabled: boolean;
  reviewNoticeEnabled: boolean;
  showCaliforniaNotice: boolean;
  showDoNotSellLink: boolean;
};

export function getDefaultPlatformStorefrontPrivacySettings(): ResolvedPlatformStorefrontPrivacySettings {
  return {
    noticeAtCollectionEnabled: true,
    checkoutNoticeEnabled: true,
    newsletterNoticeEnabled: true,
    reviewNoticeEnabled: true,
    showCaliforniaNotice: false,
    showDoNotSellLink: false
  };
}

export function resolvePlatformStorefrontPrivacySettings(
  record: PlatformStorefrontPrivacySettingsRecord | null | undefined
): ResolvedPlatformStorefrontPrivacySettings {
  const fallback = getDefaultPlatformStorefrontPrivacySettings();
  if (!record) {
    return fallback;
  }

  return {
    noticeAtCollectionEnabled: record.notice_at_collection_enabled,
    checkoutNoticeEnabled: record.checkout_notice_enabled,
    newsletterNoticeEnabled: record.newsletter_notice_enabled,
    reviewNoticeEnabled: record.review_notice_enabled,
    showCaliforniaNotice: record.show_california_notice,
    showDoNotSellLink: record.show_do_not_sell_link
  };
}

export async function getPlatformStorefrontPrivacySettings(
  supabase: SupabaseClient
): Promise<PlatformStorefrontPrivacySettingsRecord | null> {
  const { data, error } = await supabase
    .from("platform_storefront_privacy_settings")
    .select("*")
    .eq("key", "default")
    .maybeSingle<PlatformStorefrontPrivacySettingsRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
