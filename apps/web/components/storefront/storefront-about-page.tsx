"use client";

import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Mail, Music2, Truck } from "lucide-react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioAboutSectionActions } from "@/components/storefront/storefront-studio-about-section-actions";
import { StorefrontStudioEditableRichText } from "@/components/storefront/storefront-studio-editable-rich-text";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { StorefrontStudioInlineAddTile } from "@/components/storefront/storefront-studio-inline-add-tile";
import { StorefrontStudioSelectableRegion } from "@/components/storefront/storefront-studio-selectable-region";
import { buildStorefrontPoliciesPath, buildStorefrontProductsPath } from "@/lib/storefront/paths";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { addAboutSection } from "@/lib/storefront/studio-structure";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { getStorefrontPageShellClass, getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

type AboutSection = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  layout: "image_left" | "image_right" | "full";
};

function normalizeAboutSections(input: unknown, options?: { includeEmptyDrafts?: boolean }): AboutSection[] {
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
      if (!id.trim()) {
        return null;
      }
      if (!options?.includeEmptyDrafts && (!title.trim() || !body.trim())) {
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
    inlineValues?: Partial<Record<"ourStoryHeading" | "questionsHeading" | "whatShapesOurWorkHeading" | "needDetailsHeading" | "needDetailsBody" | "questionsBody", string>>;
    onInlineChange?: (
      field: "ourStoryHeading" | "questionsHeading" | "whatShapesOurWorkHeading" | "needDetailsHeading" | "needDetailsBody" | "questionsBody",
      value: string
    ) => void;
    onAnnouncementChange?: (value: string) => void;
    onFulfillmentMessageChange?: (value: string) => void;
    onSupportEmailChange?: (value: string) => void;
    onSectionChange?: (sectionId: string, field: "title" | "body", value: string) => void;
    onArticleChange?: (value: string) => void;
  };
};

export function StorefrontAboutPage({ store, viewer, branding, settings, contentBlocks, studio }: StorefrontAboutPageProps) {
  const runtime = useOptionalStorefrontRuntime();
  const studioDocument = useOptionalStorefrontStudioDocument();
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const resolvedContentBlocks = resolvedPresentation?.contentBlocks ?? contentBlocks;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const routeBasePath = runtime?.routeBasePath ?? "";
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });
  const studioEnabled = runtime?.mode === "studio" || Boolean(studio?.enabled);

  const socials = [
    { label: "Instagram", href: resolvedSettings?.instagram_url ?? null },
    { label: "Facebook", href: resolvedSettings?.facebook_url ?? null },
    { label: "TikTok", href: resolvedSettings?.tiktok_url ?? null }
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));
  const aboutSections = normalizeAboutSections(resolvedSettings?.about_sections, { includeEmptyDrafts: studioEnabled });
  const fallbackSections: AboutSection[] = resolvedContentBlocks
    .filter((block) => block.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((block) => ({
      id: block.id,
      title: block.title,
      body: block.body,
      imageUrl: null,
      layout: "full"
    }));
  const hasStructuredContent = aboutSections.some((section) => section.title.trim().length > 0 || section.body.trim().length > 0 || Boolean(section.imageUrl));
  const renderedSections = hasStructuredContent ? aboutSections : [...fallbackSections, ...aboutSections];
  const aboutArticleHtml = sanitizeRichTextHtml(resolvedSettings?.about_article_html ?? "");
  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(themeConfig.radiusScale);
  const cardClass = getStorefrontCardStyleClass(themeConfig.cardStyle);
  const ourStoryHeading = studio?.inlineValues?.ourStoryHeading ?? copy.about.ourStoryHeading;
  const questionsHeading = studio?.inlineValues?.questionsHeading ?? copy.about.questionsHeading;

  useStorefrontPageView("about");

  return (
    <div
      style={{
        ...storefrontThemeStyle,
        backgroundImage: "none",
        backgroundAttachment: "fixed"
      }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && resolvedSettings?.announcement ? (
        <section
          className={
            studioEnabled
              ? "sticky top-0 z-50 w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
              : "fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
          }
        >
          {studioEnabled && studio?.onAnnouncementChange ? (
            <StorefrontStudioEditableText
              value={resolvedSettings.announcement ?? ""}
              placeholder="Add announcement text"
              wrapperClassName="mx-auto max-w-3xl"
              displayClassName="text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)]"
              editorClassName="border-white/60 bg-white/95 text-center text-xs font-medium text-slate-900"
              buttonClassName="border-white/40 bg-[color:var(--storefront-accent-foreground)]/12 text-[color:var(--storefront-accent-foreground)]"
              onChange={studio.onAnnouncementChange}
            />
          ) : (
            resolvedSettings.announcement
          )}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={resolvedStore.name}
        logoPath={resolvedBranding?.logo_path}
        showLogo={themeConfig.headerShowLogo}
        showTitle={themeConfig.headerShowTitle}
        containerClassName={getStorefrontPageWidthClass(themeConfig.pageWidth)}
        navItems={headerNavLinks}
        buttonRadiusClass={buttonRadiusClass}
        topOffsetPx={themeConfig.showPolicyStrip && resolvedSettings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={resolvedStore.slug} buttonRadiusClass={buttonRadiusClass} ariaLabel={copy.nav.openCartAria} />}
      />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn(getStorefrontPageShellClass(themeConfig.pageWidth, themeConfig.spacingScale), "focus:outline-none")}>
        <section className="space-y-6 border-b border-border/40 pb-8 pt-1 sm:space-y-8 sm:pb-10 sm:pt-2">
          <div className="grid gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:items-end">
            <div className="max-w-4xl space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.about.aboutPrefix} {resolvedStore.name}</p>
              <h1 className="text-3xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl [font-family:var(--storefront-font-heading)]">
                {themeConfig.heroHeadline.trim().toLowerCase() === resolvedStore.name.trim().toLowerCase()
                  ? `The Story Behind ${resolvedStore.name}`
                  : themeConfig.heroHeadline}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{themeConfig.heroSubcopy}</p>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)}
                  className={cn(
                    "inline-flex h-10 w-full items-center justify-center border border-border px-4 text-sm font-medium hover:bg-[color:var(--storefront-text)] hover:text-[color:var(--storefront-bg)] sm:w-auto",
                    buttonRadiusClass
                  )}
                >
                  {copy.about.shopProductsCta}
                </Link>
                <Link
                  href={buildStorefrontPoliciesPath(resolvedStore.slug, routeBasePath)}
                  className={cn(
                    STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                    "h-10 justify-center px-3 text-sm text-muted-foreground hover:text-[color:var(--storefront-text)] sm:justify-start",
                    buttonRadiusClass
                  )}
                >
                  {copy.about.shippingReturnsCta}
                </Link>
              </div>
            </div>

            <aside className={cn("space-y-3 p-4 text-sm xl:border-l xl:border-t-0 xl:bg-transparent xl:p-0 xl:pl-4", radiusClass, cardClass)}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.atAGlanceLabel}</p>
              {studioEnabled && studio?.onFulfillmentMessageChange ? (
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={resolvedSettings?.fulfillment_message ?? ""}
                    placeholder="Add fulfillment message"
                    displayClassName="text-sm"
                    editorClassName="min-h-[7rem] border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={studio.onFulfillmentMessageChange}
                  />
                </div>
              ) : resolvedSettings?.fulfillment_message ? (
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>{resolvedSettings.fulfillment_message}</p>
                </div>
              ) : null}
              {studioEnabled && studio?.onSupportEmailChange ? (
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <StorefrontStudioEditableText
                    as="p"
                    value={resolvedSettings?.support_email ?? ""}
                    placeholder="Add support email"
                    displayClassName="text-sm"
                    editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={studio.onSupportEmailChange}
                  />
                </div>
              ) : resolvedSettings?.support_email ? (
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${resolvedSettings.support_email}`} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                    {resolvedSettings.support_email}
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

        {aboutArticleHtml || (studioEnabled && studio?.onArticleChange) ? (
          <section className="space-y-4 border-b border-border/40 pb-8">
            <header className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.whoWeAreLabel}</p>
              {studioEnabled ? (
                <StorefrontStudioEditableText
                  as="h2"
                  value={ourStoryHeading}
                  placeholder="Add section heading"
                  wrapperClassName="max-w-xl"
                  displayClassName="text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)]"
                  editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)] text-slate-900"
                  onChange={(value) => studio?.onInlineChange?.("ourStoryHeading", value)}
                />
              ) : (
                <h2 className="text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)]">{ourStoryHeading}</h2>
              )}
            </header>
            {studioEnabled && studio?.onArticleChange ? (
              <StorefrontStudioEditableRichText
                value={resolvedSettings?.about_article_html ?? ""}
                placeholder="Tell your brand story..."
                displayClassName="prose prose-sm max-w-none text-[color:var(--storefront-text)] prose-headings:[font-family:var(--storefront-font-heading)] prose-p:leading-relaxed prose-li:leading-relaxed"
                editorClassName="bg-white"
                onChange={studio.onArticleChange}
              />
            ) : (
              <article
                data-rich-text-content="true"
                className="prose prose-sm max-w-none text-[color:var(--storefront-text)] prose-headings:[font-family:var(--storefront-font-heading)] prose-p:leading-relaxed prose-li:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: aboutArticleHtml }}
              />
            )}
          </section>
        ) : null}

        {renderedSections.length > 0 ? (
          <section className="space-y-6 border-b border-border/40 pb-8">
            <header className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.ourPhilosophyLabel}</p>
              {studioEnabled ? (
                <StorefrontStudioEditableText
                  as="h2"
                  value={copy.about.whatShapesOurWorkHeading}
                  placeholder="Add philosophy heading"
                  displayClassName="text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)]"
                  editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)] text-slate-900"
                  onChange={(value) => studio?.onInlineChange?.("whatShapesOurWorkHeading", value)}
                />
              ) : (
                <h2 className="text-2xl font-semibold sm:text-3xl [font-family:var(--storefront-font-heading)]">{copy.about.whatShapesOurWorkHeading}</h2>
              )}
            </header>
            <div className="space-y-8 sm:space-y-10">
              {renderedSections.map((section, index) => (
                <StorefrontStudioSelectableRegion
                  key={section.id}
                  selection={{ kind: "about-section", id: section.id }}
                  label="About section"
                  className="-mx-3 px-3"
                  accessory={
                    studioEnabled ? (
                      <StorefrontStudioAboutSectionActions
                        sectionId={section.id}
                        layout={section.layout}
                        imageUrl={section.imageUrl}
                        canMoveUp={index > 0}
                        canMoveDown={index < renderedSections.length - 1}
                      />
                    ) : null
                  }
                >
                  <article className="space-y-4 border-t border-border/50 pt-4">
                    <div
                      className={cn(
                        "grid gap-6",
                        section.imageUrl && section.layout !== "full"
                          ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start"
                          : "grid-cols-1"
                      )}
                    >
                      <div className={cn(section.layout === "image_left" ? "xl:order-2" : "xl:order-1")}>
                        {studioEnabled && studio?.onSectionChange ? (
                          <StorefrontStudioEditableText
                            as="h3"
                            value={section.title}
                            placeholder="Add section title"
                            displayClassName="text-2xl leading-tight [font-family:var(--storefront-font-heading)]"
                            editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-2xl leading-tight [font-family:var(--storefront-font-heading)] text-slate-900"
                            onChange={(value) => studio.onSectionChange?.(section.id, "title", value)}
                          />
                        ) : (
                          <h3 className="text-2xl leading-tight [font-family:var(--storefront-font-heading)]">{section.title}</h3>
                        )}
                        {studioEnabled && studio?.onSectionChange ? (
                          <StorefrontStudioEditableText
                            as="p"
                            multiline
                            value={section.body}
                            placeholder="Add section body"
                            wrapperClassName="mt-2"
                            displayClassName="text-sm leading-relaxed text-muted-foreground"
                            editorClassName="mt-2 min-h-[8rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                            onChange={(value) => studio.onSectionChange?.(section.id, "body", value)}
                          />
                        ) : (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
                        )}
                      </div>
                      {section.imageUrl && section.layout !== "full" ? (
                        <div className={cn("overflow-hidden border border-border/50", buttonRadiusClass, section.layout === "image_left" ? "md:order-1" : "md:order-2")}>
                          <Image src={section.imageUrl} alt={section.title} width={900} height={700} unoptimized className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                    </div>
                  </article>
                </StorefrontStudioSelectableRegion>
              ))}
              {studioEnabled && studioDocument ? (
                <StorefrontStudioInlineAddTile
                  label="Add about section"
                  onClick={() => {
                    studioDocument.setSectionDraft("aboutPage", (current) => addAboutSection(current));
                  }}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 border-b border-border/40 pb-8 md:grid-cols-2">
          <article className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.needDetailsLabel}</p>
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="h3"
                value={copy.about.needDetailsHeading}
                placeholder="Add need-details heading"
                displayClassName="text-2xl [font-family:var(--storefront-font-heading)]"
                editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-2xl [font-family:var(--storefront-font-heading)] text-slate-900"
                onChange={(value) => studio?.onInlineChange?.("needDetailsHeading", value)}
              />
            ) : (
              <h3 className="text-2xl [font-family:var(--storefront-font-heading)]">{copy.about.needDetailsHeading}</h3>
            )}
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="p"
                multiline
                value={copy.about.needDetailsBody}
                placeholder="Add need-details body"
                displayClassName="text-sm leading-relaxed text-muted-foreground"
                editorClassName="min-h-[7rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                onChange={(value) => studio?.onInlineChange?.("needDetailsBody", value)}
              />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.about.needDetailsBody}</p>
            )}
            <Link href={buildStorefrontPoliciesPath(resolvedStore.slug, routeBasePath)} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
              {copy.about.readPoliciesLink}
            </Link>
          </article>
          <article className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.about.questionsLabel}</p>
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="h3"
                value={questionsHeading}
                placeholder="Add questions heading"
                wrapperClassName="max-w-xl"
                displayClassName="text-2xl [font-family:var(--storefront-font-heading)]"
                editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-2xl [font-family:var(--storefront-font-heading)] text-slate-900"
                onChange={(value) => studio?.onInlineChange?.("questionsHeading", value)}
              />
            ) : (
              <h3 className="text-2xl [font-family:var(--storefront-font-heading)]">{questionsHeading}</h3>
            )}
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="p"
                multiline
                value={copy.about.questionsBody}
                placeholder="Add questions body"
                displayClassName="text-sm leading-relaxed text-muted-foreground"
                editorClassName="min-h-[7rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                onChange={(value) => studio?.onInlineChange?.("questionsBody", value)}
              />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.about.questionsBody}</p>
            )}
            {resolvedSettings?.support_email ? (
              <a
                href={`mailto:${resolvedSettings.support_email}`}
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
          storeName={resolvedStore.name}
          storeSlug={resolvedStore.slug}
          viewer={resolvedViewer}
          settings={resolvedSettings}
          buttonRadiusClass={buttonRadiusClass}
          surfaceRadiusClassName={radiusClass}
          surfaceCardClassName={cardClass}
          copy={copy}
          navLinks={footerNavLinks}
          showBackToTop={themeConfig.showFooterBackToTop}
          showOwnerLogin={themeConfig.showFooterOwnerLogin}
        />
      </main>
    </div>
  );
}
