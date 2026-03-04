import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, LifeBuoy, RotateCcw, Truck } from "lucide-react";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

export const dynamic = "force-dynamic";

const pageWidthClasses = {
  narrow: "max-w-5xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl"
} as const;

const buttonRadiusClasses = {
  soft: "!rounded-2xl",
  rounded: "!rounded-xl",
  sharp: "!rounded-none"
} as const;

type PolicyFaq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

function normalizePolicyFaqs(input: unknown): PolicyFaq[] {
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
    .filter((faq): faq is PolicyFaq => faq !== null && faq.isActive)
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

type PoliciesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
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
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: data.branding?.primary_color,
    accentColor: data.branding?.accent_color,
    themeConfig
  });

  const policyLastUpdated = data.settings?.updated_at
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(data.settings.updated_at))
    : null;
  const policyFaqs = normalizePolicyFaqs(data.settings?.policy_faqs);

  const shippingLead = extractLead(data.settings?.shipping_policy, copy.policies.shippingLeadFallback);
  const returnLead = extractLead(data.settings?.return_policy, copy.policies.returnLeadFallback);
  const supportLead = data.settings?.support_email
    ? `Reach support at ${data.settings.support_email}`
    : copy.policies.supportLeadFallback;

  return (
    <div
      style={{ ...storefrontThemeStyle, backgroundImage: "none", backgroundAttachment: "fixed" }}
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
        rightContent={<StorefrontCartButton storeSlug={data.store.slug} ariaLabel={copy.nav.openCartAria} buttonRadiusClass={buttonRadiusClass} />}
      />

      <main className={`mx-auto w-full ${pageWidthClasses[themeConfig.pageWidth]} space-y-6 px-6 py-10`}>
        <header className="space-y-3 border-b border-border/40 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.policies.customerCareEyebrow}</p>
          <h1 className="text-4xl font-semibold leading-tight [font-family:var(--storefront-font-heading)]">{copy.policies.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{copy.policies.subtitle}</p>
          {policyLastUpdated ? <p className="text-xs text-muted-foreground">{copy.policies.lastUpdatedPrefix} {policyLastUpdated}</p> : null}
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="space-y-2 border border-border/50 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              {copy.policies.shippingAtAGlance}
            </div>
            <p className="text-sm leading-relaxed">{shippingLead}</p>
          </article>
          <article className="space-y-2 border border-border/50 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              {copy.policies.returnsAtAGlance}
            </div>
            <p className="text-sm leading-relaxed">{returnLead}</p>
          </article>
          <article className="space-y-2 border border-border/50 p-4">
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
          {data.settings?.shipping_policy ? (
            <article className="space-y-3">
              <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.policies.shippingHeading}</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.settings.shipping_policy}</p>
            </article>
          ) : null}
        </section>

        <section className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            {copy.policies.returnsPolicyLabel}
          </div>
          {data.settings?.return_policy ? (
            <article className="space-y-3">
              <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.policies.returnsHeading}</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.settings.return_policy}</p>
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
            <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.policies.supportHeading}</h2>
            {data.settings?.support_email ? (
              <p className="text-sm">
                {copy.policies.supportBodyPrefix}{" "}
                <a href={`mailto:${data.settings.support_email}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
                  {data.settings.support_email}
                </a>{" "}
                and we’ll get back to you as soon as possible.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.policies.supportComingSoon}</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {copy.policies.faqLabel}
          </div>
          {policyFaqs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {policyFaqs.map((faq) => (
                <article key={faq.id} className="space-y-1 border border-border/50 p-4">
                  <h3 className="text-sm font-semibold">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <article className="space-y-1 border border-border/50 p-4">
                <h3 className="text-sm font-semibold">{copy.policies.fallbackFaq1Question}</h3>
                <p className="text-sm text-muted-foreground">
                  {extractLead(data.settings?.shipping_policy, copy.policies.fallbackFaq1Answer)}
                </p>
              </article>
              <article className="space-y-1 border border-border/50 p-4">
                <h3 className="text-sm font-semibold">{copy.policies.fallbackFaq2Question}</h3>
                <p className="text-sm text-muted-foreground">
                  {extractLead(data.settings?.return_policy, copy.policies.fallbackFaq2Answer)}
                </p>
              </article>
            </div>
          )}
        </section>

        <div className="text-sm">
          <Link href={`/about?store=${encodeURIComponent(data.store.slug)}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
            {copy.policies.backToAbout}
          </Link>
        </div>

        <StorefrontFooter
          storeName={data.store.name}
          storeSlug={data.store.slug}
          settings={data.settings}
          copy={copy}
          buttonRadiusClass={buttonRadiusClass}
          navLinks={footerNavLinks}
          showBackToTop={themeConfig.showFooterBackToTop}
          showOwnerLogin={themeConfig.showFooterOwnerLogin}
        />
      </main>
    </div>
  );
}
