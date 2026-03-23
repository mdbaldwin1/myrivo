"use client";

import Link from "next/link";
import { Clock3, LifeBuoy, RotateCcw, Truck } from "lucide-react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { StorefrontStudioInlineAddTile } from "@/components/storefront/storefront-studio-inline-add-tile";
import { StorefrontStudioPoliciesFaqActions } from "@/components/storefront/storefront-studio-policies-faq-actions";
import { StorefrontStudioSelectableRegion } from "@/components/storefront/storefront-studio-selectable-region";
import {
  buildStorefrontAboutPath,
  buildStorefrontPrivacyPath,
  buildStorefrontTermsPath
} from "@/lib/storefront/paths";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { addPoliciesFaq, updatePoliciesFaq } from "@/lib/storefront/studio-structure";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

type PolicyFaq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

function normalizePolicyFaqs(input: unknown, includeInactive = false): PolicyFaq[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((faq, index): PolicyFaq | null => {
      if (!faq || typeof faq !== "object") {
        return null;
      }
      const record = faq as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : `faq-${index}`;
      const question = typeof record.question === "string" ? record.question : "";
      const answer = typeof record.answer === "string" ? record.answer : "";
      const sortOrder = typeof record.sort_order === "number" ? record.sort_order : index;
      const isActive = typeof record.is_active === "boolean" ? record.is_active : true;
      if (!question.trim() || !answer.trim()) {
        return null;
      }
      return { id, question, answer, sortOrder, isActive };
    })
    .filter((faq): faq is PolicyFaq => faq !== null && (includeInactive || faq.isActive))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function extractLead(text: string | null | undefined, fallback: string) {
  if (!text || !text.trim()) {
    return fallback;
  }
  const normalized = text.trim();
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 179).trimEnd()}…` : firstSentence;
}

type StorefrontPoliciesPageProps = {
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
    shipping_policy: string | null;
    return_policy: string | null;
    announcement: string | null;
    footer_tagline: string | null;
    footer_note: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    storefront_copy_json?: Record<string, unknown> | null;
    policy_faqs?: unknown;
    updated_at?: string | null;
  } | null;
  studio?: {
    enabled: boolean;
    inlineValues?: Partial<
      Record<
        | "title"
        | "subtitle"
        | "shippingHeading"
        | "returnsHeading"
        | "supportHeading"
        | "supportBodyPrefix"
        | "fallbackFaq1Question"
        | "fallbackFaq1Answer"
        | "fallbackFaq2Question"
        | "fallbackFaq2Answer",
        string
      >
    >;
    onInlineChange?: (
      field:
        | "title"
        | "subtitle"
        | "shippingHeading"
        | "returnsHeading"
        | "supportHeading"
        | "supportBodyPrefix"
        | "fallbackFaq1Question"
        | "fallbackFaq1Answer"
        | "fallbackFaq2Question"
        | "fallbackFaq2Answer",
      value: string
    ) => void;
    onAnnouncementChange?: (value: string) => void;
    onShippingPolicyChange?: (value: string) => void;
    onReturnPolicyChange?: (value: string) => void;
    onSupportEmailChange?: (value: string) => void;
  };
};

export function StorefrontPoliciesPage({ store, viewer, branding, settings, studio }: StorefrontPoliciesPageProps) {
  const runtime = useOptionalStorefrontRuntime();
  const studioDocument = useOptionalStorefrontStudioDocument();
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug);
  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(themeConfig.radiusScale);
  const cardClass = getStorefrontCardStyleClass(themeConfig.cardStyle);
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });
  const studioEnabled = runtime?.mode === "studio" || Boolean(studio?.enabled);

  const policyLastUpdated = resolvedSettings?.updated_at
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(resolvedSettings.updated_at))
    : null;
  const policyFaqs = normalizePolicyFaqs(resolvedSettings?.policy_faqs, studioEnabled);

  const shippingLead = extractLead(resolvedSettings?.shipping_policy, copy.policies.shippingLeadFallback);
  const returnLead = extractLead(resolvedSettings?.return_policy, copy.policies.returnLeadFallback);
  const supportLead = resolvedSettings?.support_email
    ? `Reach support at ${resolvedSettings.support_email}`
    : copy.policies.supportLeadFallback;

  const title = studio?.inlineValues?.title ?? copy.policies.title;
  const subtitle = studio?.inlineValues?.subtitle ?? copy.policies.subtitle;
  const shippingHeading = studio?.inlineValues?.shippingHeading ?? copy.policies.shippingHeading;
  const returnsHeading = studio?.inlineValues?.returnsHeading ?? copy.policies.returnsHeading;
  const supportHeading = studio?.inlineValues?.supportHeading ?? copy.policies.supportHeading;
  const supportBodyPrefix = studio?.inlineValues?.supportBodyPrefix ?? copy.policies.supportBodyPrefix;
  const fallbackFaq1Question = studio?.inlineValues?.fallbackFaq1Question ?? copy.policies.fallbackFaq1Question;
  const fallbackFaq1Answer = studio?.inlineValues?.fallbackFaq1Answer ?? copy.policies.fallbackFaq1Answer;
  const fallbackFaq2Question = studio?.inlineValues?.fallbackFaq2Question ?? copy.policies.fallbackFaq2Question;
  const fallbackFaq2Answer = studio?.inlineValues?.fallbackFaq2Answer ?? copy.policies.fallbackFaq2Answer;

  useStorefrontPageView("policies");

  return (
    <div
      style={{ ...storefrontThemeStyle, backgroundImage: "none", backgroundAttachment: "fixed" }}
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
        rightContent={<StorefrontCartButton storeSlug={resolvedStore.slug} ariaLabel={copy.nav.openCartAria} buttonRadiusClass={buttonRadiusClass} />}
      />

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={`mx-auto w-full ${getStorefrontPageWidthClass(themeConfig.pageWidth)} space-y-6 px-4 py-7 focus:outline-none sm:px-6 sm:py-9 lg:py-10`}
      >
        <header className="space-y-3 border-b border-border/40 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.policies.customerCareEyebrow}</p>
          {studioEnabled ? (
            <StorefrontStudioEditableText
              as="h1"
              value={title}
              placeholder="Add page title"
              wrapperClassName="max-w-2xl"
              displayClassName="text-3xl font-semibold leading-tight sm:text-4xl [font-family:var(--storefront-font-heading)]"
              editorClassName="min-h-[3.5rem] border-slate-300 bg-white/95 text-3xl font-semibold leading-tight sm:text-4xl [font-family:var(--storefront-font-heading)] text-slate-900"
              onChange={(value) => studio?.onInlineChange?.("title", value)}
            />
          ) : (
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl [font-family:var(--storefront-font-heading)]">{title}</h1>
          )}
          {studioEnabled ? (
            <StorefrontStudioEditableText
              as="p"
              multiline
              value={subtitle}
              placeholder="Add page subtitle"
              wrapperClassName="max-w-2xl"
              displayClassName="text-sm text-muted-foreground"
              editorClassName="min-h-[6rem] border-slate-300 bg-white/95 text-sm text-slate-900"
              onChange={(value) => studio?.onInlineChange?.("subtitle", value)}
            />
          ) : (
            <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          )}
          {policyLastUpdated ? <p className="text-xs text-muted-foreground">{copy.policies.lastUpdatedPrefix} {policyLastUpdated}</p> : null}
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className={cn("space-y-2 p-4", radiusClass, cardClass)}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              {copy.policies.shippingAtAGlance}
            </div>
            <p className="text-sm leading-relaxed">{shippingLead}</p>
          </article>
          <article className={cn("space-y-2 p-4", radiusClass, cardClass)}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              {copy.policies.returnsAtAGlance}
            </div>
            <p className="text-sm leading-relaxed">{returnLead}</p>
          </article>
          <article className={cn("space-y-2 p-4 sm:col-span-2 xl:col-span-1", radiusClass, cardClass)}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <LifeBuoy className="h-3.5 w-3.5" />
              {copy.policies.supportAtAGlance}
            </div>
            <p className="text-sm leading-relaxed">{supportLead}</p>
          </article>
        </section>

        <section className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            {copy.policies.shippingPolicyLabel}
          </div>
          {resolvedSettings?.shipping_policy ? (
            <article className="space-y-3">
              {studioEnabled ? (
                <StorefrontStudioEditableText
                  as="h2"
                  value={shippingHeading}
                  placeholder="Shipping heading"
                  wrapperClassName="max-w-lg"
                  displayClassName="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]"
                  editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)] text-slate-900"
                  onChange={(value) => studio?.onInlineChange?.("shippingHeading", value)}
                />
              ) : (
                <h2 className="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]">{shippingHeading}</h2>
              )}
              {studioEnabled && studio?.onShippingPolicyChange ? (
                <StorefrontStudioEditableText
                  as="p"
                  multiline
                  value={resolvedSettings.shipping_policy}
                  placeholder="Add shipping policy"
                  displayClassName="text-sm whitespace-pre-wrap leading-relaxed"
                  editorClassName="min-h-[9rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                  onChange={studio.onShippingPolicyChange}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{resolvedSettings.shipping_policy}</p>
              )}
            </article>
          ) : null}
        </section>

        <section className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            {copy.policies.returnsPolicyLabel}
          </div>
          {resolvedSettings?.return_policy ? (
            <article className="space-y-3">
              {studioEnabled ? (
                <StorefrontStudioEditableText
                  as="h2"
                  value={returnsHeading}
                  placeholder="Returns heading"
                  wrapperClassName="max-w-lg"
                  displayClassName="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]"
                  editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)] text-slate-900"
                  onChange={(value) => studio?.onInlineChange?.("returnsHeading", value)}
                />
              ) : (
                <h2 className="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]">{returnsHeading}</h2>
              )}
              {studioEnabled && studio?.onReturnPolicyChange ? (
                <StorefrontStudioEditableText
                  as="p"
                  multiline
                  value={resolvedSettings.return_policy}
                  placeholder="Add returns policy"
                  displayClassName="text-sm whitespace-pre-wrap leading-relaxed"
                  editorClassName="min-h-[9rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                  onChange={studio.onReturnPolicyChange}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{resolvedSettings.return_policy}</p>
              )}
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.policies.returnComingSoon}</p>
          )}
        </section>

        <section className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <LifeBuoy className="h-3.5 w-3.5" />
            {copy.policies.supportLabel}
          </div>
          <div className="space-y-2">
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="h2"
                value={supportHeading}
                placeholder="Support heading"
                wrapperClassName="max-w-lg"
                displayClassName="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]"
                editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)] text-slate-900"
                onChange={(value) => studio?.onInlineChange?.("supportHeading", value)}
              />
            ) : (
              <h2 className="text-xl font-semibold sm:text-2xl [font-family:var(--storefront-font-heading)]">{supportHeading}</h2>
            )}
            {studioEnabled && studio?.onSupportEmailChange ? (
              <div className="space-y-2">
                <StorefrontStudioEditableText
                  as="p"
                  value={supportBodyPrefix}
                  placeholder="Support body intro"
                  displayClassName="text-sm"
                  editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-sm text-slate-900"
                  onChange={(value) => studio?.onInlineChange?.("supportBodyPrefix", value)}
                />
                <StorefrontStudioEditableText
                  as="p"
                  value={resolvedSettings?.support_email ?? ""}
                  placeholder="Add support email"
                  displayClassName="text-sm font-medium"
                  editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-sm text-slate-900"
                  onChange={studio.onSupportEmailChange}
                />
              </div>
            ) : resolvedSettings?.support_email ? (
              <p className="text-sm">
                {supportBodyPrefix}{" "}
                <a href={`mailto:${resolvedSettings.support_email}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
                  {resolvedSettings.support_email}
                </a>{" "}
                and we’ll get back to you as soon as possible.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.policies.supportComingSoon}</p>
            )}
          </div>
        </section>

        <section className={cn("space-y-3 p-4", radiusClass, cardClass)}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.policies.formalDocumentsLabel}
          </p>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={buildStorefrontPrivacyPath(resolvedStore.slug)} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
              {copy.policies.privacyPolicyLink}
            </Link>
            <Link href={buildStorefrontTermsPath(resolvedStore.slug)} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
              {copy.policies.termsConditionsLink}
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {copy.policies.faqLabel}
          </div>
          {policyFaqs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {policyFaqs.map((faq) => (
                <StorefrontStudioSelectableRegion
                  key={faq.id}
                  selection={{ kind: "policies-faq", id: faq.id }}
                  label="FAQ item"
                  accessory={
                    studioEnabled ? (
                      <StorefrontStudioPoliciesFaqActions
                        faqId={faq.id}
                        isVisible={faq.isActive}
                        canMoveUp={policyFaqs.findIndex((entry) => entry.id === faq.id) > 0}
                        canMoveDown={policyFaqs.findIndex((entry) => entry.id === faq.id) < policyFaqs.length - 1}
                      />
                    ) : null
                  }
                >
                  <article className={cn("space-y-1 p-4", radiusClass, cardClass, !faq.isActive && "opacity-55")}>
                    {studioEnabled && studioDocument ? (
                      <StorefrontStudioEditableText
                        as="h3"
                        value={faq.question}
                        placeholder="Add FAQ question"
                        displayClassName="text-sm font-semibold"
                        editorClassName="min-h-[2.75rem] border-slate-300 bg-white/95 text-sm font-semibold text-slate-900"
                        onChange={(value) =>
                          studioDocument.setSectionDraft("policiesPage", (current) => updatePoliciesFaq(current, faq.id, { question: value }))
                        }
                      />
                    ) : (
                      <h3 className="text-sm font-semibold">{faq.question}</h3>
                    )}
                    {studioEnabled && studioDocument ? (
                      <StorefrontStudioEditableText
                        as="p"
                        multiline
                        value={faq.answer}
                        placeholder="Add FAQ answer"
                        displayClassName="text-sm text-muted-foreground"
                        editorClassName="min-h-[6rem] border-slate-300 bg-white/95 text-sm text-slate-900"
                        onChange={(value) =>
                          studioDocument.setSectionDraft("policiesPage", (current) => updatePoliciesFaq(current, faq.id, { answer: value }))
                        }
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    )}
                  </article>
                </StorefrontStudioSelectableRegion>
              ))}
              {studioEnabled && studioDocument ? (
                <div className="md:col-span-2">
                  <StorefrontStudioInlineAddTile
                    label="Add FAQ item"
                    onClick={() => {
                      studioDocument.setSectionDraft("policiesPage", (current) => addPoliciesFaq(current));
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <article className={cn("space-y-1 p-4", radiusClass, cardClass)}>
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="h3"
                    value={fallbackFaq1Question}
                    placeholder="Add FAQ question"
                    displayClassName="text-sm font-semibold"
                    editorClassName="min-h-[2.75rem] border-slate-300 bg-white/95 text-sm font-semibold text-slate-900"
                    onChange={(value) => studio?.onInlineChange?.("fallbackFaq1Question", value)}
                  />
                ) : (
                  <h3 className="text-sm font-semibold">{fallbackFaq1Question}</h3>
                )}
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={fallbackFaq1Answer}
                    placeholder="Add FAQ answer"
                    displayClassName="text-sm text-muted-foreground"
                    editorClassName="min-h-[6rem] border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={(value) => studio?.onInlineChange?.("fallbackFaq1Answer", value)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{extractLead(resolvedSettings?.shipping_policy, fallbackFaq1Answer)}</p>
                )}
              </article>
              <article className={cn("space-y-1 p-4", radiusClass, cardClass)}>
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="h3"
                    value={fallbackFaq2Question}
                    placeholder="Add FAQ question"
                    displayClassName="text-sm font-semibold"
                    editorClassName="min-h-[2.75rem] border-slate-300 bg-white/95 text-sm font-semibold text-slate-900"
                    onChange={(value) => studio?.onInlineChange?.("fallbackFaq2Question", value)}
                  />
                ) : (
                  <h3 className="text-sm font-semibold">{fallbackFaq2Question}</h3>
                )}
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={fallbackFaq2Answer}
                    placeholder="Add FAQ answer"
                    displayClassName="text-sm text-muted-foreground"
                    editorClassName="min-h-[6rem] border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={(value) => studio?.onInlineChange?.("fallbackFaq2Answer", value)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{extractLead(resolvedSettings?.return_policy, fallbackFaq2Answer)}</p>
                )}
              </article>
              {studioEnabled && studioDocument ? (
                <div className="md:col-span-2">
                  <StorefrontStudioInlineAddTile
                    label="Add FAQ item"
                    onClick={() => {
                      studioDocument.setSectionDraft("policiesPage", (current) => addPoliciesFaq(current));
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}
        </section>

        <div className="text-sm">
          <Link href={buildStorefrontAboutPath(resolvedStore.slug)} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
            {copy.policies.backToAbout}
          </Link>
        </div>

        <StorefrontFooter
          storeName={resolvedStore.name}
          storeSlug={resolvedStore.slug}
          viewer={resolvedViewer}
          settings={resolvedSettings}
          copy={copy}
          buttonRadiusClass={buttonRadiusClass}
          surfaceRadiusClassName={radiusClass}
          surfaceCardClassName={cardClass}
          navLinks={footerNavLinks}
          showBackToTop={themeConfig.showFooterBackToTop}
          showOwnerLogin={themeConfig.showFooterOwnerLogin}
        />
      </main>
    </div>
  );
}
