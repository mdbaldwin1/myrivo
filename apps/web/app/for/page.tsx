import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";

const solutions = [
  {
    href: "/for/handmade-products",
    title: "Store builder for handmade products",
    description: "Launch a branded store for handcrafted goods with inventory, orders, and customer communication in one place."
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
          Choose the operating model that matches your commerce business.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Choose the path that matches your business model and review how Myrivo supports storefront launch, fulfillment reliability, and growth workflows.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-3">
        {solutions.map((solution) => (
          <article key={solution.href} className="rounded-2xl border border-border bg-white p-6">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{solution.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
            <div className="mt-4">
              <Link href={solution.href}>
                <Button variant="outline" size="sm" className="rounded-full border-[hsl(var(--primary))]/35 bg-card text-[hsl(var(--primary))] hover:bg-primary/10">
                  Open solution
                </Button>
              </Link>
            </div>
          </article>
        ))}
      </section>
    </MarketingSiteChrome>
  );
}
