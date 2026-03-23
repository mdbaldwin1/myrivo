import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const comparisonRows = [
  {
    area: "Branded storefront",
    myrivo: "The storefront is part of the platform, so brand, product presentation, and checkout live together from the start.",
    alternatives: "Often means starting with a generic theme, a marketplace profile, or a separate website plus checkout stack."
  },
  {
    area: "Selling workflow",
    myrivo: "Products, promotions, reviews, pickup or shipping, and order management live in one connected system.",
    alternatives: "Usually requires extra apps, plugins, or manual work across multiple tools."
  },
  {
    area: "Pricing model",
    myrivo: "Start on one public plan with no monthly subscription to start and one all-in transaction fee.",
    alternatives: "Often combines monthly software fees with separate payment processing costs."
  },
  {
    area: "Seller independence",
    myrivo: "Sellers get their own branded storefront instead of depending on marketplace traffic and marketplace rules.",
    alternatives: "Marketplace tools trade brand control for built-in audience."
  },
  {
    area: "Setup clarity",
    myrivo: "Payments, tax path, pickup, and shipping are set up inside one dashboard before launch.",
    alternatives: "Getting live often means jumping between providers and figuring out setup steps on your own."
  }
];

export default async function ComparePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/compare" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise relative overflow-hidden py-8 sm:py-12 lg:py-16">
        <div className="relative max-w-4xl">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Comparison</p>
          <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-[1.04] text-foreground sm:text-6xl">
            Myrivo vs. marketplaces, generic store builders, and stitched-together setups
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            Myrivo is for product sellers who want their own branded storefront plus the selling workflow behind it, without assembling a site builder,
            checkout stack, and fulfillment setup from separate systems.
          </p>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-14 space-y-5">
        {comparisonRows.map((row) => (
          <article key={row.area} className="rounded-[1.9rem] bg-white/62 p-6 shadow-[0_16px_42px_rgba(20,35,28,0.04)] backdrop-blur-sm sm:p-8">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{row.area}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] bg-[linear-gradient(180deg,hsl(var(--brand-secondary-soft)),rgba(255,255,255,0.92))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-secondary))]">Myrivo</p>
                <p className="mt-2 text-sm leading-7 text-foreground">{row.myrivo}</p>
              </div>
              <div className="rounded-[1.4rem] bg-white/72 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Typical alternatives</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{row.alternatives}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-24 rounded-[2.35rem] bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary)))] p-8 text-primary-foreground shadow-[0_28px_80px_rgba(63,58,122,0.24)] sm:mt-28 sm:p-10">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight sm:text-4xl">Next step</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[hsl(var(--primary-foreground))]">
          If you want your own storefront and a more connected way to run products, checkout, and fulfillment, start with a free account or explore the
          use cases where Myrivo fits best.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <MarketingTrackedButtonLink
            href="/signup"
            ctaKey="compare_next_create_account"
            ctaLabel="Create account"
            sectionKey="next_step"
            conversionIntent="signup"
            className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
          >
            Create account
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/for/handmade-products"
            ctaKey="compare_next_open_handmade"
            ctaLabel="Open handmade products page"
            sectionKey="next_step"
            variant="outline"
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/45 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            Explore handmade selling
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/features"
            ctaKey="compare_next_open_features"
            ctaLabel="Open features"
            sectionKey="next_step"
            variant="outline"
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/45 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            View features
          </MarketingTrackedButtonLink>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
