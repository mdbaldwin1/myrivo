import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig, type StorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { cn } from "@/lib/utils";

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

function resolvePageWidthClass(themeConfig: StorefrontThemeConfig) {
  switch (themeConfig.pageWidth) {
    case "narrow":
      return "max-w-4xl";
    case "wide":
      return "max-w-7xl";
    default:
      return "max-w-6xl";
  }
}

function resolveRadiusClass(themeConfig: StorefrontThemeConfig) {
  switch (themeConfig.radiusScale) {
    case "soft":
      return "rounded-2xl";
    case "rounded":
      return "rounded-xl";
    default:
      return "rounded-none";
  }
}

function resolveSpacingClass(themeConfig: StorefrontThemeConfig) {
  switch (themeConfig.spacingScale) {
    case "compact":
      return "space-y-4 px-4 py-8 sm:px-5";
    case "airy":
      return "space-y-8 px-6 py-12 sm:px-8";
    default:
      return "space-y-6 px-6 py-10";
  }
}

function resolveSurfaceClass(themeConfig: StorefrontThemeConfig, radiusClass: string) {
  const base = cn(
    "border border-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] bg-[color:color-mix(in_srgb,var(--storefront-surface)_88%,transparent)]",
    radiusClass
  );

  switch (themeConfig.cardStyle) {
    case "outline":
      return cn(base, "bg-transparent");
    case "elevated":
      return cn(base, "shadow-[0_14px_34px_rgba(var(--storefront-primary-rgb),0.16)]");
    case "integrated":
      return cn(radiusClass, "border-0 bg-transparent shadow-none");
    default:
      return cn(base, "shadow-sm");
  }
}

async function loadStorefrontLoadingTheme(slug: string | null) {
  if (!slug) {
    return {
      themeConfig: resolveStorefrontThemeConfig({}),
      themeStyle: buildStorefrontThemeStyle({})
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();

  if (!store) {
    return {
      themeConfig: resolveStorefrontThemeConfig({}),
      themeStyle: buildStorefrontThemeStyle({})
    };
  }

  const { data: branding } = await admin
    .from("store_branding")
    .select("primary_color,accent_color,theme_json")
    .eq("store_id", store.id)
    .maybeSingle<{
      primary_color: string | null;
      accent_color: string | null;
      theme_json: Record<string, unknown> | null;
    }>();

  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const themeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });

  return {
    themeConfig,
    themeStyle
  };
}

export type StorefrontLoadingContext = {
  slug: string | null;
  themeConfig: StorefrontThemeConfig;
  themeStyle: CSSProperties;
  radiusClass: string;
  pageWidthClass: string;
  spacingClass: string;
  surfaceClass: string;
  isAiry: boolean;
  contentGapClass: string;
};

export async function resolveStorefrontLoadingContext(explicitSlug?: string | null): Promise<StorefrontLoadingContext> {
  let routeCandidates: Array<string | null> = [];

  try {
    const requestHeaders = await headers();
    routeCandidates = [
      requestHeaders.get("next-url"),
      requestHeaders.get("x-pathname"),
      requestHeaders.get("x-invoke-path"),
      requestHeaders.get("x-matched-path"),
      requestHeaders.get("referer")
    ];
  } catch {
    routeCandidates = [];
  }

  const headerSlug = routeCandidates
    .map((value) => extractStorefrontSlugFromPath(value))
    .find((value): value is string => Boolean(value));
  const slug = normalizeSlug(explicitSlug) ?? headerSlug ?? null;

  const { themeConfig, themeStyle } = await loadStorefrontLoadingTheme(slug);
  const radiusClass = resolveRadiusClass(themeConfig);
  const pageWidthClass = resolvePageWidthClass(themeConfig);
  const spacingClass = resolveSpacingClass(themeConfig);
  const surfaceClass = resolveSurfaceClass(themeConfig, radiusClass);
  const isAiry = themeConfig.spacingScale === "airy";
  const contentGapClass = isAiry ? "gap-8" : "gap-6";

  return {
    slug,
    themeConfig,
    themeStyle,
    radiusClass,
    pageWidthClass,
    spacingClass,
    surfaceClass,
    isAiry,
    contentGapClass
  };
}
