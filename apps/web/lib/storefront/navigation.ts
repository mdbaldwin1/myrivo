import type { StorefrontCopyConfig } from "@/lib/storefront/copy";
import {
  buildStorefrontAboutPath,
  buildStorefrontCartPath,
  buildStorefrontHomePath,
  buildStorefrontPoliciesPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";
import type { StorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type NavLink = {
  label: string;
  href: string;
};

function resolveStorefrontHref(
  storeSlug: string | undefined,
  fallbackHref: string,
  buildHref: (storeSlug: string, routeBasePath?: string | null) => string,
  routeBasePath?: string | null
) {
  if (!storeSlug) {
    return fallbackHref;
  }

  return buildHref(storeSlug, routeBasePath);
}

export function resolveHeaderNavLinks(
  themeConfig: StorefrontThemeConfig,
  copy: StorefrontCopyConfig,
  storeSlug?: string,
  routeBasePath?: string | null
): NavLink[] {
  return themeConfig.headerNavItems.map((id) => {
    if (id === "home") {
      return { label: copy.nav.home, href: storeSlug ? buildStorefrontHomePath(storeSlug, routeBasePath) : "/" };
    }

    if (id === "products") {
      return { label: copy.nav.products, href: resolveStorefrontHref(storeSlug, "/products", buildStorefrontProductsPath, routeBasePath) };
    }

    if (id === "about") {
      return { label: copy.nav.about, href: resolveStorefrontHref(storeSlug, "/about", buildStorefrontAboutPath, routeBasePath) };
    }

    return { label: copy.nav.policies, href: resolveStorefrontHref(storeSlug, "/policies", buildStorefrontPoliciesPath, routeBasePath) };
  });
}

export function resolveFooterNavLinks(
  themeConfig: StorefrontThemeConfig,
  copy: StorefrontCopyConfig,
  storeSlug?: string,
  routeBasePath?: string | null
): NavLink[] {
  return themeConfig.footerNavItems.map((id) => {
    if (id === "products") {
      return { label: copy.footer.allProductsLink, href: resolveStorefrontHref(storeSlug, "/products", buildStorefrontProductsPath, routeBasePath) };
    }

    if (id === "cart") {
      return { label: copy.footer.cartLink, href: resolveStorefrontHref(storeSlug, "/cart", buildStorefrontCartPath, routeBasePath) };
    }

    if (id === "about") {
      return { label: copy.footer.aboutLink, href: resolveStorefrontHref(storeSlug, "/about", buildStorefrontAboutPath, routeBasePath) };
    }

    return { label: copy.footer.policiesLink, href: resolveStorefrontHref(storeSlug, "/policies", buildStorefrontPoliciesPath, routeBasePath) };
  });
}
