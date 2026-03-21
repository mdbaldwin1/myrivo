import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";

const solutions = [
  {
    href: "/for/handmade-products",
    title: "Store builder for handmade products",
    description: "Launch a branded shop for handmade goods, skincare, pottery, woodwork, apparel, and other small-batch products."
  },
  {
    href: "/for/local-pickup-orders",
    title: "Commerce with local pickup scheduling",
    description: "Offer local pickup windows, location selection rules, and fulfillment-ready order workflows."
  },
  {
    href: "/for/multi-store-commerce",
    title: "Multi-store commerce operations",
    description: "Run multiple stores with role controls, approvals, moderation, and centralized platform governance."
  }
];

export default function SolutionsIndexPage() {
  return (
    <MarketingSiteChrome activePath="/for">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Solutions</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Find the setup that fits the way you sell.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Whether you sell handmade products, offer local pickup, or run multiple stores, Myrivo gives you a branded storefront and the core workflows you need to start selling quickly.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-3">
        {solutions.map((solution) => (
          <article key={solution.href} className="rounded-2xl border border-border bg-white p-6">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{solution.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
            <div className="mt-4">
              <MarketingTrackedButtonLink
                href={solution.href}
                ctaKey={`solutions_grid_${solution.href.split("/").at(-1) ?? "detail"}`}
                ctaLabel={`Open ${solution.title}`}
                sectionKey="solutions_grid"
                variant="outline"
                size="sm"
                className="rounded-full border-[hsl(var(--primary))]/35 bg-card text-[hsl(var(--primary))] hover:bg-primary/10"
              >
                Open solution
              </MarketingTrackedButtonLink>
            </div>
          </article>
        ))}
      </section>
    </MarketingSiteChrome>
  );
}
