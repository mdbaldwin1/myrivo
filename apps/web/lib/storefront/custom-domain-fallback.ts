import { normalizeHost } from "@/lib/stores/domain-utils";
import type { StorefrontUnavailableData } from "@/lib/storefront/unavailable";

function stripWww(host: string) {
  return host.startsWith("www.") ? host.slice(4) : host;
}

function titleizeDomainLabel(host: string) {
  const label = stripWww(host).split(".")[0] ?? "storefront";
  return label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^athome/i, "at home")
    .replace(/apothecary/i, " apothecary")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function isNonPlatformCustomHost(input: { host?: string | null; appUrl?: string | null }) {
  const normalizedHost = normalizeHost(input.host);
  if (!normalizedHost) {
    return false;
  }

  try {
    const appHost = normalizeHost(new URL(input.appUrl ?? "").hostname);
    const bareHost = stripWww(normalizedHost);
    const bareAppHost = appHost ? stripWww(appHost) : null;
    return Boolean(bareAppHost && bareHost !== bareAppHost);
  } catch {
    return false;
  }
}

export function buildCustomDomainUnavailableState(input: {
  host: string;
  storeSlug?: string | null;
}): StorefrontUnavailableData {
  const normalizedHost = normalizeHost(input.host) ?? "storefront";
  const storeName = titleizeDomainLabel(normalizedHost) || "Storefront";
  const storeSlug = input.storeSlug?.trim().toLowerCase() || stripWww(normalizedHost).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    kind: "service_unavailable",
    store: {
      id: `custom-domain:${normalizedHost}`,
      name: storeName,
      slug: storeSlug || "storefront"
    },
    viewer: {
      isAuthenticated: false,
      canManageStore: false
    },
    branding: {
      logo_path: null,
      favicon_path: null,
      apple_touch_icon_path: null,
      og_image_path: null,
      twitter_image_path: null,
      primary_color: null,
      accent_color: null,
      theme_json: null
    },
    settings: {
      support_email: null,
      fulfillment_message: null,
      shipping_policy: null,
      return_policy: null,
      announcement: "Please check back soon.",
      footer_tagline: null,
      footer_note: null,
      instagram_url: null,
      facebook_url: null,
      tiktok_url: null
    }
  };
}
