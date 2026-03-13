"use client";

import { CookiePolicyContent } from "@/components/privacy/cookie-policy-content";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import type { StorefrontRuntime } from "@/lib/storefront/runtime";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type StorefrontCookiePolicyPageProps = {
  runtime: StorefrontRuntime;
};

export function StorefrontCookiePolicyPage({ runtime }: StorefrontCookiePolicyPageProps) {
  const themeConfig = resolveStorefrontThemeConfig(runtime.branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(runtime.settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, runtime.store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, runtime.store.slug);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: runtime.branding?.primary_color,
    accentColor: runtime.branding?.accent_color,
    themeConfig
  });
  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const cardStyleClass = getStorefrontCardStyleClass(themeConfig.cardStyle);

  useStorefrontPageView("policies");

  return (
    <div
      style={storefrontThemeStyle}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && runtime.settings?.announcement ? (
        <section className="fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6">
          {runtime.settings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={runtime.store.name}
        logoPath={runtime.branding?.logo_path}
        showLogo={themeConfig.headerShowLogo}
        showTitle={themeConfig.headerShowTitle}
        containerClassName={getStorefrontPageWidthClass(themeConfig.pageWidth)}
        navItems={headerNavLinks}
        buttonRadiusClass={getStorefrontButtonRadiusClass(themeConfig.radiusScale)}
        topOffsetPx={themeConfig.showPolicyStrip && runtime.settings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={runtime.store.slug} ariaLabel={copy.nav.openCartAria} />}
      />

      <main className={`mx-auto w-full ${getStorefrontPageWidthClass(themeConfig.pageWidth)} px-4 py-7 sm:px-6 sm:py-9 lg:py-10`}>
        <article className={`mx-auto max-w-5xl p-6 sm:p-8 ${radiusClass} ${cardStyleClass}`}>
          <CookiePolicyContent scopeLabel={runtime.store.name} />
        </article>
      </main>

      <StorefrontFooter
        storeName={runtime.store.name}
        storeSlug={runtime.store.slug}
        viewer={runtime.viewer}
        settings={runtime.settings}
        copy={copy}
        navLinks={footerNavLinks}
      />
    </div>
  );
}
