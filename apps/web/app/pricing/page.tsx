import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { withReturnTo } from "@/lib/auth/return-to";
import { formatMoney, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const faqItems = [
  {
    question: "Do I need a monthly subscription to start?",
    answer: "No. Starter is usage-based with a transaction fee profile and no monthly platform charge."
  },
  {
    question: "How do platform fees work?",
    answer:
      "Each paid order records a fee snapshot in billing reporting so payout math is auditable. Your store sees platform fee and net payout per order."
  },
  {
    question: "Can I start small and upgrade later?",
    answer: "Yes. You can move between active plans and keep operating history, order data, and content settings."
  },
  {
    question: "Is tax handled by Myrivo or Stripe?",
    answer: "Stripe Tax should handle tax calculation and collection. Myrivo remains the commerce workflow layer while Stripe handles tax logic."
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
  const primaryCta = isAuthenticated
    ? { label: "Open Dashboard", href: "/dashboard?entry=pricing", variant: "default" as const }
    : { label: "Start Free", href: "/signup?source=pricing", variant: "default" as const };
  const secondaryCta = isAuthenticated
    ? { label: "Billing Settings", href: "/dashboard/billing?entry=pricing", variant: "outline" as const }
    : { label: "Sign in", href: withReturnTo("/login", "/pricing?source=pricing"), variant: "outline" as const };

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <div className="space-y-6 py-8">
        <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pricing</p>
          <h1 className="mt-2 text-4xl font-semibold">Simple pricing built for growing commerce operators.</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Start on a no-monthly plan, then upgrade as volume grows. All plan pricing is read from live billing configuration and reflected in order-level fee
            snapshots for clear payout reporting.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={primaryCta.href}>
              <Button variant={primaryCta.variant}>{primaryCta.label}</Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button variant={secondaryCta.variant}>{secondaryCta.label}</Button>
            </Link>
            <Link href="mailto:hello@myrivo.app?subject=Myrivo%20Sales%20Question&body=I%27d%20like%20help%20choosing%20a%20plan.">
              <Button variant="outline">Talk to Sales</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-xl border bg-card p-5 shadow-sm ${plan.recommended ? "border-emerald-300 ring-1 ring-emerald-200" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.recommended ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Recommended</span>
                ) : null}
              </div>
              <p className="mt-3 text-3xl font-semibold">{plan.monthlyPriceCents === 0 ? "$0" : formatMoney(plan.monthlyPriceCents)}</p>
              <p className="text-sm text-muted-foreground">{plan.monthlyPriceCents === 0 ? "per month" : "per month + transaction fee"}</p>
              <div className="mt-4 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                <p>
                  <span className="font-medium">Platform fee:</span> {formatPlatformFeePercent(plan.feeBps)}
                </p>
                <p>
                  <span className="font-medium">Fixed fee:</span> {formatMoney(plan.feeFixedCents)}
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.highlights.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
              <Link className="mt-5 inline-flex" href={isAuthenticated ? "/dashboard/billing?entry=pricing-plan" : "/signup?source=pricing-plan"}>
                <Button className="w-full">{isAuthenticated ? "Open Billing" : "Choose Plan"}</Button>
              </Link>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Feature Comparison</h2>
          <p className="mt-2 text-sm text-muted-foreground">Capabilities you unlock as your store operation scales.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 font-medium">Capability</th>
                  {plans.map((plan) => (
                    <th key={plan.key} className="border-b border-border px-3 py-2 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Custom domain storefront</td>
                  {plans.map((plan) => (
                    <td key={`${plan.key}-domain`} className="border-b border-border/70 px-3 py-2">
                      {plan.featureFlags.customDomain ? "Included" : "Not included"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-b border-border/70 px-3 py-2 text-muted-foreground">Priority support lane</td>
                  {plans.map((plan) => (
                    <td key={`${plan.key}-support`} className="border-b border-border/70 px-3 py-2">
                      {plan.featureFlags.prioritySupport ? "Included" : "Standard"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">White-label controls</td>
                  {plans.map((plan) => (
                    <td key={`${plan.key}-label`} className="px-3 py-2">
                      {plan.featureFlags.whiteLabel ? "Included" : "Not included"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Trust and Risk Reduction</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>- Fee snapshots are written per order for audit-ready payout trails.</li>
              <li>- Test mode and role-based controls reduce accidental production changes.</li>
              <li>- Store approvals and legal version acceptance improve governance before go-live.</li>
            </ul>
          </article>
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Need enterprise planning?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If you need custom onboarding, migration support, or high-scale platform architecture guidance, reach out and we can scope rollout support.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/compare">
                <Button variant="outline">Compare Options</Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline">Read Docs</Button>
              </Link>
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          <div className="mt-4 space-y-4">
            {faqItems.map((faq) => (
              <article key={faq.question} className="rounded-lg border border-border/70 p-4">
                <h3 className="font-medium">{faq.question}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
