import type { StorefrontSettings } from "@/lib/storefront/runtime";
import type { StoreSettingsRecord } from "@/types/database";

type WelcomePopupSettings =
  | Pick<
  StoreSettingsRecord,
  | "email_capture_enabled"
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
>
  | StorefrontSettings
  | null;

export type StorefrontWelcomePopupConfig = {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  body: string;
  emailPlaceholder: string;
  ctaLabel: string;
  declineLabel: string;
  imageLayout: "top" | "left";
  delaySeconds: number;
  dismissDays: number;
  imagePath: string | null;
  promotionId: string | null;
  campaignKey: string;
};

export const STOREFRONT_WELCOME_POPUP_SURFACES = ["home", "products", "productDetail", "about", "policies"] as const;

export const STOREFRONT_WELCOME_POPUP_SOURCE = "storefront_welcome_popup";
export const STOREFRONT_WELCOME_POPUP_PREVIEW_EVENT = "myrivo:welcome-popup-preview";
export const STOREFRONT_WELCOME_POPUP_CLOSED_EVENT = "myrivo:welcome-popup-closed";

function buildStudioPreviewKey(storeSlug: string) {
  return `myrivo:welcome-popup:studio-preview:${storeSlug}`;
}

function resolveStringSetting(value: string | null | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().length > 0 ? value : fallback;
}

function resolveImageLayout(value: string | null | undefined): "top" | "left" {
  return value === "top" ? "top" : "left";
}

export function resolveWelcomePopupConfig(
  settings: WelcomePopupSettings
): StorefrontWelcomePopupConfig {
  const promotionId = settings?.welcome_popup_promotion_id ?? null;
  const eyebrow = resolveStringSetting(settings?.welcome_popup_eyebrow, "Welcome offer");
  const headline = resolveStringSetting(settings?.welcome_popup_headline, "Enjoy a welcome offer");
  const body = resolveStringSetting(
    settings?.welcome_popup_body,
    "Join the email list to get your welcome discount code sent straight to your inbox. You can unsubscribe anytime."
  );
  const ctaLabel = resolveStringSetting(settings?.welcome_popup_cta_label, "Email my discount");
  const declineLabel = resolveStringSetting(settings?.welcome_popup_decline_label, "Decline offer");
  const emailPlaceholder = resolveStringSetting(settings?.welcome_popup_email_placeholder, "Email address");
  const imageLayout = resolveImageLayout(settings?.welcome_popup_image_layout);
  const delaySeconds = Math.min(60, Math.max(0, settings?.welcome_popup_delay_seconds ?? 6));
  const dismissDays = Math.min(365, Math.max(1, settings?.welcome_popup_dismiss_days ?? 14));
  const enabled = Boolean(settings?.email_capture_enabled && settings?.welcome_popup_enabled && promotionId);
  const campaignKey = [promotionId ?? "no-promo", headline, body, ctaLabel, delaySeconds, dismissDays].join(":");

  return {
    enabled,
    eyebrow,
    headline,
    body,
    emailPlaceholder,
    ctaLabel,
    declineLabel,
    imageLayout,
    delaySeconds,
    dismissDays,
    imagePath: settings?.welcome_popup_image_path ?? null,
    promotionId,
    campaignKey
  };
}

export function getWelcomePopupStudioPreview(storeSlug: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(buildStudioPreviewKey(storeSlug)) === "true";
}

export function setWelcomePopupStudioPreview(storeSlug: string, open: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (open) {
    window.sessionStorage.setItem(buildStudioPreviewKey(storeSlug), "true");
  } else {
    window.sessionStorage.removeItem(buildStudioPreviewKey(storeSlug));
  }

  window.dispatchEvent(new CustomEvent(STOREFRONT_WELCOME_POPUP_PREVIEW_EVENT, { detail: { storeSlug, open } }));
}
