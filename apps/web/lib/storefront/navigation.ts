import type { StorefrontCopyConfig } from "@/lib/storefront/copy";
import type { FooterItemId, NavItemId, StorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type NavLink = {
  label: string;
  href: string;
};

function appendStoreQuery(href: string, storeSlug?: string): string {
  if (!storeSlug) {
    return href;
  }
  return `${href}${href.includes("?") ? "&" : "?"}store=${encodeURIComponent(storeSlug)}`;
}

function resolveHomeHref(storeSlug?: string) {
  if (!storeSlug) {
    return "/";
  }
  return `/s/${encodeURIComponent(storeSlug)}`;
}

const HEADER_LINKS_BY_ID: Record<NavItemId, (copy: StorefrontCopyConfig, storeSlug?: string) => NavLink> = {
  home: (copy, storeSlug) => ({ label: copy.nav.home, href: resolveHomeHref(storeSlug) }),
  products: (copy) => ({ label: copy.nav.products, href: "/products" }),
  about: (copy) => ({ label: copy.nav.about, href: "/about" }),
  policies: (copy) => ({ label: copy.nav.policies, href: "/policies" })
};

const FOOTER_LINKS_BY_ID: Record<FooterItemId, (copy: StorefrontCopyConfig) => NavLink> = {
  products: (copy) => ({ label: copy.footer.allProductsLink, href: "/products" }),
  cart: (copy) => ({ label: copy.footer.cartLink, href: "/cart" }),
  about: (copy) => ({ label: copy.footer.aboutLink, href: "/about" }),
  policies: (copy) => ({ label: copy.footer.policiesLink, href: "/policies" })
};

export function resolveHeaderNavLinks(themeConfig: StorefrontThemeConfig, copy: StorefrontCopyConfig, storeSlug?: string): NavLink[] {
  return themeConfig.headerNavItems.map((id) => {
    const link = HEADER_LINKS_BY_ID[id](copy, storeSlug);
    return { ...link, href: appendStoreQuery(link.href, storeSlug) };
  });
}

export function resolveFooterNavLinks(themeConfig: StorefrontThemeConfig, copy: StorefrontCopyConfig, storeSlug?: string): NavLink[] {
  return themeConfig.footerNavItems.map((id) => {
    const link = FOOTER_LINKS_BY_ID[id](copy);
    return { ...link, href: appendStoreQuery(link.href, storeSlug) };
  });
}
