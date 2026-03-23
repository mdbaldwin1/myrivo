import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { formatMoney, formatMoneyWithCents, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const standardPlan = plans[0] ?? null;
  const publicPlanName = standardPlan?.name ?? "Standard";
  const monthlyPriceLabel = standardPlan ? (standardPlan.monthlyPriceCents === 0 ? "$0" : formatMoney(standardPlan.monthlyPriceCents)) : "$0";
  const orderFeeLabel = standardPlan ? `${formatPlatformFeePercent(standardPlan.feeBps)} + ${formatMoneyWithCents(standardPlan.feeFixedCents)}` : "6.00% + $0.30";
  const faqItems = [
    {
      question: "Do I need a monthly subscription to start?",
      answer: `No. ${publicPlanName} starts at ${monthlyPriceLabel} monthly, so you can begin selling without a recurring platform subscription.`
    },
    {
      question: "How do platform fees work?",
      answer: `Each successful order on ${publicPlanName} is charged ${orderFeeLabel}. Stripe processing is already included in that fee, so sellers see one clearer fee model.`
    },
    {
      question: "Is there more than one public plan right now?",
      answer: `Not right now. ${publicPlanName} is the current public plan, so sellers can start with one straightforward offer.`
    },
    {
      question: "Is tax handled by Myrivo or Stripe?",
      answer: "Stripe Tax handles calculation at checkout, but sellers are still responsible for their own tax setup, registrations, and filings on their connected Stripe accounts."
    }
  ] as const;

  return (
    <MarketingSiteChrome activePath="/pricing" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise relative overflow-hidden py-8 sm:py-12 lg:py-16">
        <div className="relative max-w-4xl">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pricing</p>
          <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-[1.04] text-foreground sm:text-6xl">
            Start selling without a monthly subscription.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            The current public plan is {publicPlanName}: {monthlyPriceLabel} monthly, then {orderFeeLabel} per successful order with Stripe processing
            included.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
              className="h-11 rounded-full border-[hsl(var(--primary))]/30 bg-white/70 px-6 text-[hsl(var(--primary))] hover:bg-white"
            >
              Compare approaches
            </MarketingTrackedButtonLink>
            <MarketingTrackedButtonLink
              href="mailto:hello@myrivo.app?subject=Myrivo%20Pricing%20Question&body=I%27d%20like%20help%20understanding%20Myrivo%20pricing."
              ctaKey="pricing_hero_talk_to_sales"
              ctaLabel="Ask a pricing question"
              sectionKey="hero"
              conversionIntent="demo_request"
              variant="outline"
              className="h-11 rounded-full border-[hsl(var(--primary))]/30 bg-white/70 px-6 text-[hsl(var(--primary))] hover:bg-white"
            >
              Ask a pricing question
            </MarketingTrackedButtonLink>
          </div>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-14 grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <article className="rounded-[2.2rem] bg-[linear-gradient(155deg,hsl(var(--primary)),hsl(var(--brand-secondary))_58%,hsl(var(--accent)))] p-7 text-primary-foreground shadow-[0_28px_80px_rgba(63,58,122,0.24)] sm:p-9">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">Current public plan</p>
          <h2 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight sm:text-4xl">
            {publicPlanName}
          </h2>
          <div className="mt-6 flex items-end gap-3">
            <p className="text-5xl font-semibold">{monthlyPriceLabel}</p>
            <p className="pb-2 text-sm text-[hsl(var(--primary-foreground))]">per month</p>
          </div>
          <p className="mt-4 text-lg font-medium">{orderFeeLabel} per successful order</p>
          <p className="mt-3 max-w-lg text-sm leading-7 text-[hsl(var(--primary-foreground))]">
            That transaction fee covers Stripe processing too, so sellers see one clearer fee model instead of a platform fee plus separate Stripe charges.
          </p>
          <div className="mt-8 border-t border-white/20 pt-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">What you get</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[hsl(var(--primary-foreground))]">
              {(standardPlan?.highlights ?? [
                "High-touch storefront, checkout, and seller operations",
                "Branded commerce experience with no required monthly base",
                "Single all-in Myrivo fee that covers Stripe processing"
              ]).map((item) => (
                <li key={item} className="border-t border-white/15 pt-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-7">
            <MarketingTrackedButtonLink
              href={isAuthenticated ? "/dashboard/billing?entry=pricing-plan" : "/signup?source=pricing-plan"}
              ctaKey={`pricing_plan_${standardPlan?.key ?? "standard"}`}
              ctaLabel={isAuthenticated ? `View ${standardPlan?.name ?? "Standard"}` : `Get started with ${standardPlan?.name ?? "Standard"}`}
              sectionKey="plan_cards"
              conversionIntent={isAuthenticated ? undefined : "signup"}
              className="h-10 w-full rounded-full bg-background text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
            >
              {isAuthenticated ? "View plan details" : "Get started"}
            </MarketingTrackedButtonLink>
          </div>
        </article>

        <article className="rounded-[1.95rem] bg-white/62 p-6 shadow-[0_16px_42px_rgba(20,35,28,0.04)] backdrop-blur-sm sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Why sellers like this model</p>
          <h3 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-foreground">
            Simple pricing is part of the product.
          </h3>
          <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
            <p className="border-t border-border/60 pt-5">
              There is one current public plan, so sellers can decide quickly instead of sorting through tiers that do not apply yet.
            </p>
            <p className="border-t border-border/60 pt-5">
              The important numbers are clear up front: <span className="font-medium text-foreground">{monthlyPriceLabel} monthly</span> and
              <span className="font-medium text-foreground"> {orderFeeLabel}</span> per successful order.
            </p>
            <p className="border-t border-border/60 pt-5">
              Stripe processing is already included, so sellers are not mentally stacking a platform fee on top of a separate processing line item.
            </p>
          </div>
        </article>
      </section>

      <section className="marketing-rise marketing-delay-2 mt-24 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start sm:mt-28">
        <article className="p-1 sm:p-2">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl text-foreground sm:text-4xl">What is included in Standard</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">A simple breakdown of the current public plan.</p>
          <div className="mt-5 overflow-x-auto rounded-[1.6rem] bg-white/58 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:p-4">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">Capability</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">{publicPlanName}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Custom domain storefront</td>
                  <td className="border-b border-border/70 px-3 py-2 text-foreground">{standardPlan?.featureFlags.customDomain ? "Included" : "Not included"}</td>
                </tr>
                <tr>
                  <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Priority support lane</td>
                  <td className="border-b border-border/70 px-3 py-2 text-foreground">{standardPlan?.featureFlags.prioritySupport ? "Included" : "Standard"}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">White-label controls</td>
                  <td className="px-3 py-2 text-foreground">{standardPlan?.featureFlags.whiteLabel ? "Included" : "Not included"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[2.2rem] bg-[linear-gradient(150deg,hsl(var(--primary)),hsl(var(--brand-secondary))_58%,hsl(var(--accent)))] p-7 text-primary-foreground shadow-[0_28px_80px_rgba(63,58,122,0.24)] sm:p-8">
          <h3 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl leading-tight">Frequently asked questions</h3>
          <div className="mt-5 space-y-4">
            {faqItems.map((faq) => (
              <div key={faq.question} className="border-t border-white/20 pt-4">
                <p className="text-sm font-semibold text-[hsl(var(--primary-foreground))]">{faq.question}</p>
                <p className="mt-2 text-sm leading-7 text-[hsl(var(--primary-foreground))]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
