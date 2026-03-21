import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";

const comparisonRows = [
  {
    area: "Branded storefront",
    myrivo: "A polished storefront is part of the product, so sellers do not have to piece together a site and a checkout stack.",
    alternatives: "Often means starting with a generic storefront theme, a marketplace profile, or a separate site builder."
  },
  {
    area: "Selling workflow",
    myrivo: "Products, checkout, pickup, shipping, promos, and order workflows live in one connected system.",
    alternatives: "Usually requires extra apps, plugins, or manual work across multiple tools."
  },
  {
    area: "Pricing model",
    myrivo: "Start without a monthly subscription and pay only when orders come through.",
    alternatives: "Often combines monthly software fees with separate payment processing costs."
  },
  {
    area: "Seller independence",
    myrivo: "Sellers get their own branded storefront instead of depending on marketplace traffic and marketplace rules.",
    alternatives: "Marketplace tools trade brand control for built-in audience."
  },
  {
    area: "Setup clarity",
    myrivo: "Payments, tax handling, and fulfillment setup are guided inside one dashboard.",
    alternatives: "Getting live often means jumping between providers and figuring out setup steps on your own."
  }
];

export default function ComparePage() {
  return (
    <MarketingSiteChrome activePath="/compare">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Comparison</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Myrivo vs. marketplaces, generic store builders, and stitched-together setups
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo is built for product sellers who want their own branded shop without assembling a website, checkout, fulfillment, and customer workflow from separate systems.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4">
        {comparisonRows.map((row) => (
          <article key={row.area} className="rounded-2xl border border-border bg-white p-5">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{row.area}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-accent/30 bg-[hsl(var(--muted))] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground">Myrivo</p>
                <p className="mt-1 text-sm text-foreground">{row.myrivo}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Typical alternatives</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.alternatives}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-6 rounded-3xl border border-border bg-primary p-8 text-primary-foreground">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl">Next step</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--primary-foreground))]">
          If you want a more branded, more guided way to sell handmade and small-batch products online, start with a free account and build your first storefront.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
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
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            Explore handmade selling
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/features"
            ctaKey="compare_next_open_features"
            ctaLabel="Open features"
            sectionKey="next_step"
            variant="outline"
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            Open features
          </MarketingTrackedButtonLink>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
