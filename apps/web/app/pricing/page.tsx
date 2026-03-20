import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { formatMoney, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const faqItems = [
  {
    question: "Do I need a monthly subscription to start?",
    answer: "No. Myrivo can run stores on transaction-fee-only pricing, and any paid plan changes are assigned by the Myrivo team rather than self-served in the product."
  },
  {
    question: "How do platform fees work?",
    answer:
      "Each paid order records a fee snapshot in billing reporting so payout math is auditable. Your store sees platform fee and net payout per order."
  },
  {
    question: "Can I start small and upgrade later?",
    answer: "Yes. We can reassign your store to a different plan without affecting operating history, order data, or storefront content."
  },
  {
    question: "Is tax handled by Myrivo or Stripe?",
    answer: "Stripe Tax handles calculation at checkout, but sellers are still responsible for their own tax setup, registrations, and filings on their connected Stripe accounts."
  }
] as const;

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: planRows } = await supabase
    .from("billing_plans")
    .select("key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents,active,feature_flags_json")
    .order("monthly_price_cents", { ascending: true });

  const plans = resolvePricingPlans((planRows as BillingPlanRow[] | null) ?? null);
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/pricing" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pricing</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Start lean. Scale with control.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Plan pricing comes from live billing config and every paid order snapshots fee math for audit-grade payout reporting.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <MarketingTrackedButtonLink
            href={isAuthenticated ? "/dashboard/billing?entry=pricing" : "/signup?source=pricing"}
            ctaKey={isAuthenticated ? "pricing_hero_view_billing" : "pricing_hero_start_free"}
            ctaLabel={isAuthenticated ? "View billing" : "Start free"}
            sectionKey="hero"
            conversionIntent={isAuthenticated ? undefined : "signup"}
            className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary"
          >
            {isAuthenticated ? "View billing" : "Start free"}
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/compare"
            ctaKey="pricing_hero_compare"
            ctaLabel="Compare approaches"
            sectionKey="hero"
            variant="outline"
            className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10"
          >
            Compare approaches
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="mailto:hello@myrivo.app?subject=Myrivo%20Sales%20Question&body=I%27d%20like%20help%20choosing%20a%20plan."
            ctaKey="pricing_hero_talk_to_sales"
            ctaLabel="Talk to sales"
            sectionKey="hero"
            conversionIntent="demo_request"
            variant="outline"
            className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10"
          >
            Talk to sales
          </MarketingTrackedButtonLink>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.key}
            className={`rounded-2xl border p-6 ${plan.recommended ? "border-accent bg-[hsl(var(--muted))]" : "border-border bg-white"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{plan.name}</h2>
              {plan.recommended ? (
                <span className="rounded-full border border-accent/30 bg-[hsl(var(--accent))]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                  Popular
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-4xl font-semibold text-foreground">{plan.monthlyPriceCents === 0 ? "$0" : formatMoney(plan.monthlyPriceCents)}</p>
            <p className="text-sm text-muted-foreground">{plan.monthlyPriceCents === 0 ? "monthly base" : "monthly base + fee"}</p>
            <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-foreground">
              <p>Platform fee: {formatPlatformFeePercent(plan.feeBps)}</p>
              <p>Fixed fee: {formatMoney(plan.feeFixedCents)}</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {plan.highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <div className="mt-5">
              <MarketingTrackedButtonLink
                href={isAuthenticated ? "/dashboard/billing?entry=pricing-plan" : "/signup?source=pricing-plan"}
                ctaKey={`pricing_plan_${plan.key}`}
                ctaLabel={isAuthenticated ? `View ${plan.name}` : `Get started with ${plan.name}`}
                sectionKey="plan_cards"
                conversionIntent={isAuthenticated ? undefined : "signup"}
                className="h-10 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary"
              >
                {isAuthenticated ? "View plan details" : "Get started"}
              </MarketingTrackedButtonLink>
            </div>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-6 rounded-3xl border border-border bg-white p-6 sm:p-8">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl text-foreground">Plan comparison</h2>
        <p className="mt-2 text-sm text-muted-foreground">Capabilities by plan tier.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 font-semibold text-foreground">Capability</th>
                {plans.map((plan) => (
                  <th key={plan.key} className="border-b border-border px-3 py-2 font-semibold text-foreground">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Custom domain storefront</td>
                {plans.map((plan) => (
                  <td key={`${plan.key}-domain`} className="border-b border-border/70 px-3 py-2 text-foreground">
                    {plan.featureFlags.customDomain ? "Included" : "Not included"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Priority support lane</td>
                {plans.map((plan) => (
                  <td key={`${plan.key}-support`} className="border-b border-border/70 px-3 py-2 text-foreground">
                    {plan.featureFlags.prioritySupport ? "Included" : "Standard"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2 text-muted-foreground">White-label controls</td>
                {plans.map((plan) => (
                  <td key={`${plan.key}-label`} className="px-3 py-2 text-foreground">
                    {plan.featureFlags.whiteLabel ? "Included" : "Not included"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h3 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Trust and compliance</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Fee snapshots per order for clear audit trails.</li>
            <li>• Store lifecycle controls keep non-live storefronts private until they are ready.</li>
            <li>• Legal acceptance and governance controls before go-live.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-border bg-white p-6">
          <h3 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Frequently asked questions</h3>
          <div className="mt-3 space-y-3">
            {faqItems.map((faq) => (
              <div key={faq.question} className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold text-[hsl(var(--primary))]">{faq.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
