import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
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
    <PageShell maxWidthClassName="max-w-6xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Solutions</p>
        <h1 className="text-4xl font-semibold">Myrivo solution pages for specific commerce needs</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose the path that matches your business model and review how Myrivo supports storefront launch, fulfillment reliability, and growth workflows.
        </p>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {solutions.map((solution) => (
          <SectionCard key={solution.href} title={solution.title}>
            <p className="text-sm text-muted-foreground">{solution.description}</p>
            <div className="mt-3">
              <Link href={solution.href}>
                <Button variant="outline" size="sm">Open page</Button>
              </Link>
            </div>
          </SectionCard>
        ))}
      </section>
    </PageShell>
  );
}
