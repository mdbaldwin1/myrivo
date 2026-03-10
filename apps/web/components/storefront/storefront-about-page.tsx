"use client";

import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Mail, Music2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

const spacingClasses = {
  compact: "space-y-5 px-4 py-8 sm:px-6",
  comfortable: "space-y-8 px-6 py-10",
  airy: "space-y-10 px-6 py-12"
} as const;

const buttonRadiusClasses = {
  soft: "!rounded-2xl",
  rounded: "!rounded-xl",
  sharp: "!rounded-none"
} as const;

const pageWidthClasses = {
  narrow: "max-w-5xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl"
} as const;

type AboutSection = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  layout: "image_left" | "image_right" | "full";
};

function normalizeAboutSections(input: unknown): AboutSection[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((section): AboutSection | null => {
      if (!section || typeof section !== "object") {
        return null;
      }
      const record = section as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const title = typeof record.title === "string" ? record.title : "";
      const body = typeof record.body === "string" ? record.body : "";
      const imageUrl = typeof record.imageUrl === "string" && record.imageUrl.trim().length > 0 ? record.imageUrl : null;
      const layout = record.layout === "image_left" || record.layout === "image_right" || record.layout === "full" ? record.layout : "image_right";
      if (!id.trim() || !title.trim() || !body.trim()) {
        return null;
      }
      return { id, title, body, imageUrl, layout };
    })
    .filter((section): section is AboutSection => section !== null);
}

function renderSocialIcon(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "instagram") return <Instagram className="h-4 w-4" />;
  if (normalized === "facebook") return <Facebook className="h-4 w-4" />;
  if (normalized === "tiktok") return <Music2 className="h-4 w-4" />;
  return null;
}

type StorefrontAboutPageProps = {
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
    about_article_html?: string | null;
    about_sections?: unknown;
  } | null;
  contentBlocks: Array<{
    id: string;
    sort_order: number;
    eyebrow: string | null;
    title: string;
    body: string;
    cta_label: string | null;
    cta_url: string | null;
    is_active: boolean;
  }>;
  studio?: {
    enabled: boolean;
    inlineValues?: Partial<Record<"ourStoryHeading" | "questionsHeading", string>>;
    onInlineChange?: (field: "ourStoryHeading" | "questionsHeading", value: string) => void;
  };
};

export function StorefrontAboutPage({ store, viewer, branding, settings, contentBlocks, studio }: StorefrontAboutPageProps) {
  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, store.slug);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });
  const studioEnabled = Boolean(studio?.enabled);

  const socials = [
    { label: "Instagram", href: settings?.instagram_url ?? null },
    { label: "Facebook", href: settings?.facebook_url ?? null },
    { label: "TikTok", href: settings?.tiktok_url ?? null }
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));
  const aboutSections = normalizeAboutSections(settings?.about_sections);
  const fallbackSections: AboutSection[] = contentBlocks
    .filter((block) => block.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((block) => ({
      id: block.id,
      title: block.title,
      body: block.body,
      imageUrl: null,
      layout: "full"
    }));
  const renderedSections = aboutSections.length > 0 ? aboutSections : fallbackSections;
  const aboutArticleHtml = sanitizeRichTextHtml(settings?.about_article_html ?? "");
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];
  const ourStoryHeading = studio?.inlineValues?.ourStoryHeading ?? copy.about.ourStoryHeading;
  const questionsHeading = studio?.inlineValues?.questionsHeading ?? copy.about.questionsHeading;

  return (
    <div
      style={{
        ...storefrontThemeStyle,
        backgroundImage: "none",
        backgroundAttachment: "fixed"
      }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && settings?.announcement ? (
        <section
          className={
            studioEnabled
              ? "sticky top-0 z-50 w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
              : "fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
          }
        >
          {settings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={store.name}
        logoPath={branding?.logo_path}
        showTitle={themeConfig.heroBrandDisplay !== "logo" || !branding?.logo_path}
        containerClassName={pageWidthClasses[themeConfig.pageWidth]}
        navItems={headerNavLinks}
        buttonRadiusClass={buttonRadiusClass}
        topOffsetPx={themeConfig.showPolicyStrip && settings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={store.slug} buttonRadiusClass={buttonRadiusClass} ariaLabel={copy.nav.openCartAria} />}
      />
      <main className={cn("mx-auto w-full", pageWidthClasses[themeConfig.pageWidth], spacingClasses[themeConfig.spacingScale])}>
        <section className="space-y-8 border-b border-border/40 pb-10 pt-2">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="max-w-4xl space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.about.aboutPrefix} {store.name}</p>
              <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl [font-family:var(--storefront-font-heading)]">
                {themeConfig.heroHeadline.trim().toLowerCase() === store.name.trim().toLowerCase()
                  ? `The Story Behind ${store.name}`
                  : themeConfig.heroHeadline}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{themeConfig.heroSubcopy}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/products?store=${encodeURIComponent(store.slug)}`}
                  className={cn(
                    "inline-flex h-10 items-center justify-center border border-border px-4 text-sm font-medium hover:bg-[color:var(--storefront-text)] hover:text-[color:var(--storefront-bg)]",
                    buttonRadiusClass
                  )}
                >
                  {copy.about.shopProductsCta}
                </Link>
                <Link
                  href={`/policies?store=${encodeURIComponent(store.slug)}`}
                  className={cn(
                    STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                    "h-10 px-3 text-sm text-muted-foreground hover:text-[color:var(--storefront-text)]",
                    buttonRadiusClass
                  )}
                >
                  {copy.about.shippingReturnsCta}
                </Link>
              </div>
            </div>

            <aside className="space-y-3 border-l border-border/50 pl-4 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.atAGlanceLabel}</p>
              {settings?.fulfillment_message ? (
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>{settings.fulfillment_message}</p>
                </div>
              ) : null}
              {settings?.support_email ? (
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${settings.support_email}`} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                    {settings.support_email}
                  </a>
                </div>
              ) : null}
              {socials.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={social.label}
                      title={social.label}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center border border-border/70 hover:bg-muted/40",
                        buttonRadiusClass
                      )}
                    >
                      {renderSocialIcon(social.label)}
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        {aboutArticleHtml ? (
          <section className="space-y-4 border-b border-border/40 pb-8">
            <header className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.whoWeAreLabel}</p>
              {studioEnabled ? (
                <Input
                  value={ourStoryHeading}
                  onChange={(event) => studio?.onInlineChange?.("ourStoryHeading", event.target.value)}
                  className="h-10 max-w-xl border-dashed bg-white/80"
                />
              ) : (
                <h2 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)]">{ourStoryHeading}</h2>
              )}
            </header>
            <article
              className="prose prose-sm max-w-none text-[color:var(--storefront-text)] prose-headings:[font-family:var(--storefront-font-heading)] prose-p:leading-relaxed prose-li:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: aboutArticleHtml }}
            />
          </section>
        ) : null}

        {renderedSections.length > 0 ? (
          <section className="space-y-6 border-b border-border/40 pb-8">
            <header className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.ourPhilosophyLabel}</p>
              <h2 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.about.whatShapesOurWorkHeading}</h2>
            </header>
            <div className="space-y-10">
              {renderedSections.map((section) => (
                <article key={section.id} className="space-y-4 border-t border-border/50 pt-4">
                  <div
                    className={cn(
                      "grid gap-6",
                      section.imageUrl && section.layout !== "full"
                        ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start"
                        : "grid-cols-1"
                    )}
                  >
                    <div className={cn(section.layout === "image_left" ? "md:order-2" : "md:order-1")}>
                      <h3 className="text-2xl leading-tight [font-family:var(--storefront-font-heading)]">{section.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
                    </div>
                    {section.imageUrl && section.layout !== "full" ? (
                      <div className={cn("overflow-hidden border border-border/50", buttonRadiusClass, section.layout === "image_left" ? "md:order-1" : "md:order-2")}>
                        <Image src={section.imageUrl} alt={section.title} width={900} height={700} unoptimized className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 border-b border-border/40 pb-8 md:grid-cols-2">
          <article className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.needDetailsLabel}</p>
            <h3 className="text-2xl [font-family:var(--storefront-font-heading)]">{copy.about.needDetailsHeading}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.about.needDetailsBody}</p>
            <Link href={`/policies?store=${encodeURIComponent(store.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
              {copy.about.readPoliciesLink}
            </Link>
          </article>
          <article className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.questionsLabel}</p>
            {studioEnabled ? (
              <Input
                value={questionsHeading}
                onChange={(event) => studio?.onInlineChange?.("questionsHeading", event.target.value)}
                className="h-10 max-w-xl border-dashed bg-white/80"
              />
            ) : (
              <h3 className="text-2xl [font-family:var(--storefront-font-heading)]">{questionsHeading}</h3>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.about.questionsBody}</p>
            {settings?.support_email ? (
              <a
                href={`mailto:${settings.support_email}`}
                className={cn(
                  "inline-flex h-9 items-center justify-center border border-border px-3 text-sm font-medium hover:bg-muted/40",
                  buttonRadiusClass
                )}
              >
                {copy.about.contactSupport}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.about.supportComingSoon}</p>
            )}
          </article>
        </section>

        <StorefrontFooter
          storeName={store.name}
          storeSlug={store.slug}
          viewer={viewer}
          settings={settings}
          buttonRadiusClass={buttonRadiusClass}
          copy={copy}
          navLinks={footerNavLinks}
          showBackToTop={themeConfig.showFooterBackToTop}
          showOwnerLogin={themeConfig.showFooterOwnerLogin}
        />
      </main>
    </div>
  );
}
