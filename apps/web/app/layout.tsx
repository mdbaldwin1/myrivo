import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { CookieConsentProvider } from "@/components/privacy/cookie-consent-provider";
import { SkipLink } from "@/components/ui/skip-link";
import { Toaster } from "@/components/ui/toaster";
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsent } from "@/lib/privacy/cookies";
import { resolveBrowserPrivacySignalsFromHeaders } from "@/lib/privacy/signals";
import { mapStoreExperienceContentRow } from "@/lib/store-experience/content";
import { buildMergedStorefrontThemeJson } from "@/lib/storefront/theme-overrides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import "./globals.css";

function normalizeSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function extractStorefrontSlugFromPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const pathname = value.startsWith("/") ? value : new URL(value, "http://localhost").pathname;
    const storefrontMatch = pathname.match(/^\/s\/([^/?#]+)/i);
    if (storefrontMatch?.[1]) {
      return normalizeSlug(storefrontMatch[1]);
    }

    const url = value.startsWith("/") ? new URL(`http://localhost${value}`) : new URL(value, "http://localhost");
    return normalizeSlug(url.searchParams.get("store"));
  } catch {
    return null;
  }
}

function defaultMetadata(): Metadata {
  return {
    title: "Myrivo",
    description: "Commerce platform for independent makers",
    icons: {
      icon: [
        { url: "/brand/myrivo-favicon.svg", type: "image/svg+xml" },
        { url: "/icon.svg", type: "image/svg+xml" }
      ],
      shortcut: ["/brand/myrivo-favicon.svg"],
      apple: ["/icon.svg"]
    }
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const headerStoreSlug =
    [
      requestHeaders.get("next-url"),
      requestHeaders.get("x-pathname"),
      requestHeaders.get("x-invoke-path"),
      requestHeaders.get("x-matched-path"),
      requestHeaders.get("referer")
    ]
      .map((value) => extractStorefrontSlugFromPath(value))
      .find((value): value is string => Boolean(value)) ?? null;
  const storeSlug = headerStoreSlug ?? (await resolveStoreSlugFromDomain(host, { includeNonPublic: true }));
  const isPathBasedStorefront = Boolean(headerStoreSlug);

  if (!storeSlug) {
    return defaultMetadata();
  }

  const admin = createSupabaseAdminClient();
  const { data: store, error } = await admin
    .from("stores")
    .select("id,name,status,white_label_enabled")
    .eq("slug", storeSlug)
    .maybeSingle<{
      id: string;
      name: string;
      status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
      white_label_enabled: boolean;
    }>();

  if (error || !store || !isStorePubliclyAccessibleStatus(store.status) || (!isPathBasedStorefront && !store.white_label_enabled)) {
    return defaultMetadata();
  }

  const brandingQuery = await admin
    .from("store_branding")
    .select("logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path")
    .eq("store_id", store.id)
    .maybeSingle<{
      logo_path: string | null;
      favicon_path: string | null;
      apple_touch_icon_path: string | null;
      og_image_path: string | null;
      twitter_image_path: string | null;
    }>();
  let branding = brandingQuery.data;

  if (
    brandingQuery.error &&
    (isMissingColumnInSchemaCache(brandingQuery.error, "favicon_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "apple_touch_icon_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "og_image_path") ||
      isMissingColumnInSchemaCache(brandingQuery.error, "twitter_image_path"))
  ) {
    const fallback = await admin
      .from("store_branding")
      .select("logo_path")
      .eq("store_id", store.id)
      .maybeSingle<{ logo_path: string | null }>();
    branding = fallback.data
      ? {
          logo_path: fallback.data.logo_path,
          favicon_path: null,
          apple_touch_icon_path: null,
          og_image_path: null,
          twitter_image_path: null
        }
      : null;
  }

  const favicon = branding?.favicon_path?.trim() || branding?.logo_path?.trim() || "/brand/myrivo-favicon.svg";
  const appleTouchIcon = branding?.apple_touch_icon_path?.trim() || favicon;
  const socialImage = branding?.og_image_path?.trim() || branding?.twitter_image_path?.trim() || null;
  const title = store.name || "Myrivo";

  return {
    title,
    description: `Storefront powered by ${title}`,
    icons: {
      icon: [{ url: favicon }],
      shortcut: [favicon],
      apple: [appleTouchIcon]
    },
    openGraph: socialImage ? { images: [{ url: socialImage }] } : undefined,
    twitter: socialImage ? { images: [socialImage] } : undefined
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const initialConsent = resolveCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null);
  const initialBrowserPrivacySignals = resolveBrowserPrivacySignalsFromHeaders(requestHeaders);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const headerStoreSlug =
    [
      requestHeaders.get("next-url"),
      requestHeaders.get("x-pathname"),
      requestHeaders.get("x-invoke-path"),
      requestHeaders.get("x-matched-path"),
      requestHeaders.get("referer")
    ]
      .map((value) => extractStorefrontSlugFromPath(value))
      .find((value): value is string => Boolean(value)) ?? null;
  const storeSlug = headerStoreSlug ?? (await resolveStoreSlugFromDomain(host, { includeNonPublic: true }));

  let storefrontBodyStyle: CSSProperties | undefined;
  let storefrontBodyDataset:
    | {
        "data-storefront-theme-active": "true";
        "data-storefront-slug": string;
        "data-storefront-radius-scale": string;
        "data-storefront-card-style": string;
        "data-storefront-page-width": string;
        "data-storefront-spacing-scale": string;
      }
    | undefined;

  if (storeSlug) {
    const admin = createSupabaseAdminClient();
    const { data: store } = await admin
      .from("stores")
      .select("id,status")
      .eq("slug", storeSlug)
      .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

    if (store) {
      const [{ data: branding }, { data: experienceContent }] = await Promise.all([
        admin
          .from("store_branding")
          .select("primary_color,accent_color,theme_json")
          .eq("store_id", store.id)
          .maybeSingle<{
            primary_color: string | null;
            accent_color: string | null;
            theme_json: Record<string, unknown> | null;
          }>(),
        admin
          .from("store_experience_content")
          .select("store_id,home_json,products_page_json,about_page_json,policies_page_json,cart_page_json,order_summary_page_json,emails_json")
          .eq("store_id", store.id)
          .maybeSingle()
      ]);

      const mergedThemeJson = buildMergedStorefrontThemeJson(branding?.theme_json ?? {}, mapStoreExperienceContentRow(experienceContent));
      const themeConfig = resolveStorefrontThemeConfig(mergedThemeJson);
      storefrontBodyStyle = {
        ...buildStorefrontThemeStyle({
          primaryColor: branding?.primary_color,
          accentColor: branding?.accent_color,
          themeConfig
        }),
        backgroundColor: "var(--storefront-bg)",
        backgroundImage: "none"
      };
      storefrontBodyDataset = {
        "data-storefront-theme-active": "true",
        "data-storefront-slug": storeSlug,
        "data-storefront-radius-scale": themeConfig.radiusScale,
        "data-storefront-card-style": themeConfig.cardStyle,
        "data-storefront-page-width": themeConfig.pageWidth,
        "data-storefront-spacing-scale": themeConfig.spacingScale
      };
    }
  }

  return (
    <html lang="en">
      <body style={storefrontBodyStyle} {...storefrontBodyDataset}>
        <CookieConsentProvider
          initialConsent={initialConsent}
          initialBrowserPrivacySignals={initialBrowserPrivacySignals}
        >
          <SkipLink />
          {children}
          <Toaster />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
