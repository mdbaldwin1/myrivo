import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Facebook, Instagram, Mail, Music2, Truck } from "lucide-react";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

export const dynamic = "force-dynamic";

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

type AboutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StorefrontAboutPage({ searchParams }: AboutPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
    notFound();
  }

  const themeConfig = resolveStorefrontThemeConfig(data.branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(data.settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, data.store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, data.store.slug);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: data.branding?.primary_color,
    accentColor: data.branding?.accent_color,
    themeConfig
  });

  const socials = [
    { label: "Instagram", href: data.settings?.instagram_url ?? null },
    { label: "Facebook", href: data.settings?.facebook_url ?? null },
    { label: "TikTok", href: data.settings?.tiktok_url ?? null }
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));
  const aboutSections = normalizeAboutSections(data.settings?.about_sections);
  const fallbackSections: AboutSection[] = data.contentBlocks
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
  const aboutArticleHtml = sanitizeRichTextHtml(data.settings?.about_article_html ?? "");
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];

  return (
    <div
      style={{
        ...storefrontThemeStyle,
        backgroundImage: "none",
        backgroundAttachment: "fixed"
      }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && data.settings?.announcement ? (
        <section className="fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6">
          {data.settings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={data.store.name}
        logoPath={data.branding?.logo_path}
        showTitle={themeConfig.heroBrandDisplay !== "logo" || !data.branding?.logo_path}
        containerClassName={pageWidthClasses[themeConfig.pageWidth]}
        navItems={headerNavLinks}
        buttonRadiusClass={buttonRadiusClass}
        topOffsetPx={themeConfig.showPolicyStrip && data.settings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={data.store.slug} buttonRadiusClass={buttonRadiusClass} ariaLabel={copy.nav.openCartAria} />}
      />
      <main className={cn("mx-auto w-full", pageWidthClasses[themeConfig.pageWidth], spacingClasses[themeConfig.spacingScale])}>
        <section className="space-y-8 border-b border-border/40 pb-10 pt-2">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="max-w-4xl space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.about.aboutPrefix} {data.store.name}</p>
              <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl [font-family:var(--storefront-font-heading)]">
                {themeConfig.heroHeadline.trim().toLowerCase() === data.store.name.trim().toLowerCase()
                  ? `The Story Behind ${data.store.name}`
                  : themeConfig.heroHeadline}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{themeConfig.heroSubcopy}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/products?store=${encodeURIComponent(data.store.slug)}`}
                  className={cn(
                    "inline-flex h-10 items-center justify-center border border-border px-4 text-sm font-medium hover:bg-[color:var(--storefront-text)] hover:text-[color:var(--storefront-bg)]",
                    buttonRadiusClass
                  )}
                >
                  {copy.about.shopProductsCta}
                </Link>
                <Link
                  href={`/policies?store=${encodeURIComponent(data.store.slug)}`}
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
              {data.settings?.fulfillment_message ? (
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>{data.settings.fulfillment_message}</p>
                </div>
              ) : null}
              {data.settings?.support_email ? (
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${data.settings.support_email}`} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                    {data.settings.support_email}
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
              <h2 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.about.ourStoryHeading}</h2>
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
            <Link href={`/policies?store=${encodeURIComponent(data.store.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
              {copy.about.readPoliciesLink}
            </Link>
          </article>
          <article className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.questionsLabel}</p>
            <h3 className="text-2xl [font-family:var(--storefront-font-heading)]">{copy.about.questionsHeading}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.about.questionsBody}</p>
            {data.settings?.support_email ? (
              <a
                href={`mailto:${data.settings.support_email}`}
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
          storeName={data.store.name}
          storeSlug={data.store.slug}
          viewer={data.viewer}
          settings={data.settings}
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
