import type { StorefrontCopyConfig } from "@/lib/storefront/copy";
import {
  buildStorefrontAboutPath,
  buildStorefrontCartPath,
  buildStorefrontHomePath,
  buildStorefrontPoliciesPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";
import type { FooterItemId, NavItemId, StorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type NavLink = {
  label: string;
  href: string;
};

function resolveHomeHref(storeSlug?: string) {
  if (!storeSlug) {
    return "/";
  }
  return buildStorefrontHomePath(storeSlug);
}

const HEADER_LINKS_BY_ID: Record<NavItemId, (copy: StorefrontCopyConfig, storeSlug?: string) => NavLink> = {
  home: (copy, storeSlug) => ({ label: copy.nav.home, href: resolveHomeHref(storeSlug) }),
  products: (copy, storeSlug) => ({ label: copy.nav.products, href: storeSlug ? buildStorefrontProductsPath(storeSlug) : "/products" }),
  about: (copy, storeSlug) => ({ label: copy.nav.about, href: storeSlug ? buildStorefrontAboutPath(storeSlug) : "/about" }),
  policies: (copy, storeSlug) => ({ label: copy.nav.policies, href: storeSlug ? buildStorefrontPoliciesPath(storeSlug) : "/policies" })
};

const FOOTER_LINKS_BY_ID: Record<FooterItemId, (copy: StorefrontCopyConfig, storeSlug?: string) => NavLink> = {
  products: (copy, storeSlug) => ({ label: copy.footer.allProductsLink, href: storeSlug ? buildStorefrontProductsPath(storeSlug) : "/products" }),
  cart: (copy, storeSlug) => ({ label: copy.footer.cartLink, href: storeSlug ? buildStorefrontCartPath(storeSlug) : "/cart" }),
  about: (copy, storeSlug) => ({ label: copy.footer.aboutLink, href: storeSlug ? buildStorefrontAboutPath(storeSlug) : "/about" }),
  policies: (copy, storeSlug) => ({ label: copy.footer.policiesLink, href: storeSlug ? buildStorefrontPoliciesPath(storeSlug) : "/policies" })
};

export function resolveHeaderNavLinks(themeConfig: StorefrontThemeConfig, copy: StorefrontCopyConfig, storeSlug?: string): NavLink[] {
  return themeConfig.headerNavItems.map((id) => HEADER_LINKS_BY_ID[id](copy, storeSlug));
}

export function resolveFooterNavLinks(themeConfig: StorefrontThemeConfig, copy: StorefrontCopyConfig, storeSlug?: string): NavLink[] {
  return themeConfig.footerNavItems.map((id) => FOOTER_LINKS_BY_ID[id](copy, storeSlug));
}
