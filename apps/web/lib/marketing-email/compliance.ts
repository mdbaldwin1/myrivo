import { resolvePlatformNotificationFromAddress } from "@/lib/notifications/sender";
import { buildStorefrontPrivacyPath, buildStorefrontPrivacyRequestPath } from "@/lib/storefront/paths";
import type { StoreSettingsRecord } from "@/types/database";

type MarketingComplianceStore = {
  name: string;
  slug: string;
};

type MarketingComplianceSettings = Pick<
  StoreSettingsRecord,
  | "support_email"
  | "seo_location_city"
  | "seo_location_region"
  | "seo_location_state"
  | "seo_location_postal_code"
  | "seo_location_country_code"
  | "seo_location_address_line1"
  | "seo_location_address_line2"
  | "seo_location_show_full_address"
> | null;

export type MarketingEmailComplianceDefaults = {
  messageType: "marketing";
  fromAddress: string;
  fromMode: "platform_sender";
  senderDisplayName: string;
  replyToEmail: string | null;
  supportEmail: string | null;
  unsubscribeHref: string;
  privacyPolicyHref: string;
  privacyRequestHref: string;
  footerAddress: string | null;
  readiness: {
    status: "ready" | "attention_required";
    warnings: string[];
  };
};

function buildFooterAddress(settings: MarketingComplianceSettings) {
  if (!settings) {
    return null;
  }

  const line1 = settings.seo_location_address_line1?.trim() || "";
  const line2 = settings.seo_location_address_line2?.trim() || "";
  const city = settings.seo_location_city?.trim() || "";
  const region = settings.seo_location_state?.trim() || settings.seo_location_region?.trim() || "";
  const postalCode = settings.seo_location_postal_code?.trim() || "";
  const country = settings.seo_location_country_code?.trim() || "";

  if (!line1 || !city || !region || !postalCode) {
    return null;
  }

  return [line1, line2, [city, region, postalCode].filter(Boolean).join(", "), country].filter(Boolean).join(" • ");
}

export function resolveMarketingEmailComplianceDefaults(
  store: MarketingComplianceStore,
  settings: MarketingComplianceSettings
): MarketingEmailComplianceDefaults {
  const supportEmail = settings?.support_email?.trim() || null;
  const footerAddress = buildFooterAddress(settings);
  const warnings: string[] = [];

  if (!supportEmail) {
    warnings.push("Add a monitored support email so marketing replies do not fall back to a generic platform address.");
  }

  if (!footerAddress) {
    warnings.push("Add a valid mailing address before sending marketing email so the footer can include the required postal address.");
  }

  return {
    messageType: "marketing",
    fromAddress: resolvePlatformNotificationFromAddress(),
    fromMode: "platform_sender",
    senderDisplayName: store.name,
    replyToEmail: supportEmail,
    supportEmail,
    unsubscribeHref: `/unsubscribe?store=${encodeURIComponent(store.slug)}`,
    privacyPolicyHref: buildStorefrontPrivacyPath(store.slug),
    privacyRequestHref: buildStorefrontPrivacyRequestPath(store.slug),
    footerAddress,
    readiness: {
      status: warnings.length === 0 ? "ready" : "attention_required",
      warnings
    }
  };
}
