"use client";

import Link from "next/link";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import type { ResolvedStorePrivacyProfile } from "@/lib/privacy/store-privacy";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { getStorefrontButtonRadiusClass } from "@/lib/storefront/appearance";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";

type StorefrontLegalPageProps = {
  documentKey: "privacy" | "terms";
  document: {
    title: string;
    bodyMarkdown: string;
    publishedVersion: number | null;
    effectiveAt: string | null;
    publishedAt: string | null;
  };
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

export function StorefrontLegalPage({
  documentKey,
  document,
  store,
  viewer,
  branding,
  settings,
  privacyProfile
}: StorefrontLegalPageProps) {
  const runtime = useOptionalStorefrontRuntime();
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedSettings = runtime?.settings ?? settings;
  const resolvedPrivacyProfile = runtime?.privacyProfile ?? privacyProfile;
  const themeConfig = runtime?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = runtime?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });

  useStorefrontPageView(documentKey);

  return (
    <div
      style={storefrontThemeStyle}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && resolvedSettings?.announcement ? (
        <section className="fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6">
          {resolvedSettings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={resolvedStore.name}
        logoPath={resolvedBranding?.logo_path}
        showLogo={themeConfig.headerShowLogo}
        showTitle={themeConfig.headerShowTitle}
        containerClassName={getStorefrontPageWidthClass(themeConfig.pageWidth)}
        navItems={headerNavLinks}
        buttonRadiusClass={getStorefrontButtonRadiusClass(themeConfig.radiusScale)}
        topOffsetPx={themeConfig.showPolicyStrip && resolvedSettings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={resolvedStore.slug} ariaLabel={copy.nav.openCartAria} />}
      />

      <main className={`mx-auto w-full ${getStorefrontPageWidthClass(themeConfig.pageWidth)} space-y-6 px-4 py-7 sm:px-6 sm:py-9 lg:py-10`}>
        <article className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-3 border-b border-border/40 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {resolvedStore.name}
            </p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl [font-family:var(--storefront-font-heading)]">
              {document.title}
            </h1>
            {document.publishedVersion ? (
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Version {document.publishedVersion}
                {document.effectiveAt ? ` • Effective ${new Date(document.effectiveAt).toLocaleDateString("en-US")}` : ""}
                {!document.effectiveAt && document.publishedAt
                  ? ` • Published ${new Date(document.publishedAt).toLocaleDateString("en-US")}`
                  : ""}
              </p>
            ) : null}
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {documentKey === "privacy"
                ? "How customer information is handled for this storefront."
                : "The terms that apply when shopping on this storefront."}
            </p>
          </header>

          <LegalMarkdown content={document.bodyMarkdown} />

          {documentKey === "privacy" && resolvedPrivacyProfile ? (
            <div className="space-y-5 border-t border-border/40 pt-6">
              <section className="space-y-2">
                <h2 className="text-xl font-semibold [font-family:var(--storefront-font-heading)]">Privacy contact</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Contact {resolvedPrivacyProfile.privacyContactName} at{" "}
                  <a className="font-medium underline underline-offset-4" href={`mailto:${resolvedPrivacyProfile.privacyRightsEmail}`}>
                    {resolvedPrivacyProfile.privacyRightsEmail}
                  </a>{" "}
                  for privacy questions or requests.
                </p>
              </section>

              {resolvedPrivacyProfile.showCaliforniaNotice ? (
                <section id="california-privacy-notice" className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold [font-family:var(--storefront-font-heading)]">Your California privacy rights</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      California residents can request access, deletion, correction, or additional details about how personal information is handled for this storefront.
                    </p>
                  </div>
                  {resolvedPrivacyProfile.californiaNoticeMarkdown ? (
                    <LegalMarkdown content={resolvedPrivacyProfile.californiaNoticeMarkdown} />
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/privacy/request?store=${encodeURIComponent(resolvedStore.slug)}`}
                      className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/30"
                    >
                      Submit privacy request
                    </Link>
                    {resolvedPrivacyProfile.showDoNotSellLink ? (
                      <Link
                        href={`/privacy/request?store=${encodeURIComponent(resolvedStore.slug)}&type=opt_out_sale_share`}
                        className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/30"
                      >
                        Do Not Sell or Share My Personal Information
                      </Link>
                    ) : null}
                  </div>
                  {resolvedPrivacyProfile.doNotSellMarkdown ? (
                    <LegalMarkdown content={resolvedPrivacyProfile.doNotSellMarkdown} />
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}
        </article>
      </main>

      <StorefrontFooter
        storeName={resolvedStore.name}
        storeSlug={resolvedStore.slug}
        viewer={resolvedViewer}
        settings={resolvedSettings}
        copy={copy}
        navLinks={footerNavLinks}
      />
    </div>
  );
}
