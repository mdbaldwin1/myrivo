"use client";

import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { StorefrontPrivacyRequestForm } from "@/components/storefront/storefront-privacy-request-form";
import type { ResolvedStorePrivacyProfile } from "@/lib/privacy/store-privacy";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { getStorefrontButtonRadiusClass } from "@/lib/storefront/appearance";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type StorefrontPrivacyRequestPageProps = {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  viewer?: {
    isAuthenticated: boolean;
    canManageStore: boolean;
  };
  branding: {
    logo_path: string | null;
    primary_color: string | null;
    accent_color: string | null;
    theme_json?: Record<string, unknown> | null;
  } | null;
  settings: {
    support_email: string | null;
    fulfillment_message: string | null;
    shipping_policy: string | null;
    return_policy: string | null;
    announcement: string | null;
    footer_tagline: string | null;
    footer_note: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    storefront_copy_json?: Record<string, unknown> | null;
    email_capture_enabled?: boolean | null;
    email_capture_heading?: string | null;
    email_capture_description?: string | null;
    email_capture_success_message?: string | null;
  } | null;
  privacyProfile: ResolvedStorePrivacyProfile | null;
};

export function StorefrontPrivacyRequestPage({
  store,
  viewer,
  branding,
  settings,
  privacyProfile
}: StorefrontPrivacyRequestPageProps) {
  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, store.slug);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });

  return (
    <div
      style={storefrontThemeStyle}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && settings?.announcement ? (
        <section className="fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6">
          {settings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={store.name}
        logoPath={branding?.logo_path}
        showLogo={themeConfig.headerShowLogo}
        showTitle={themeConfig.headerShowTitle}
        containerClassName={getStorefrontPageWidthClass(themeConfig.pageWidth)}
        navItems={headerNavLinks}
        buttonRadiusClass={getStorefrontButtonRadiusClass(themeConfig.radiusScale)}
        topOffsetPx={themeConfig.showPolicyStrip && settings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={store.slug} ariaLabel={copy.nav.openCartAria} />}
      />

      <main className={`mx-auto w-full ${getStorefrontPageWidthClass(themeConfig.pageWidth)} space-y-6 px-4 py-7 sm:px-6 sm:py-9 lg:py-10`}>
        <section className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-3 border-b border-border/40 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{store.name}</p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl [font-family:var(--storefront-font-heading)]">
              Privacy request
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Use this form to submit a privacy-related request for this storefront, including California rights requests when applicable.
            </p>
          </header>

          {privacyProfile?.requestPageIntroMarkdown ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-4">
              <LegalMarkdown content={privacyProfile.requestPageIntroMarkdown} />
            </div>
          ) : null}

          <StorefrontPrivacyRequestForm
            storeSlug={store.slug}
            storeName={store.name}
            privacyProfile={privacyProfile}
          />
        </section>
      </main>

      <StorefrontFooter
        storeName={store.name}
        storeSlug={store.slug}
        viewer={viewer}
        settings={settings}
        copy={copy}
        navLinks={footerNavLinks}
      />
    </div>
  );
}
