import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

export const metadata: Metadata = {
  title: "Store builder for handmade products | Myrivo",
  description: "Build a branded commerce experience for handmade products with order, inventory, and content workflows in Myrivo."
};

export default function HandmadeProductsPage() {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-4xl font-semibold">Store builder for handmade products</h1>
        <p className="text-sm text-muted-foreground">
          Myrivo helps independent makers launch a branded storefront and run operations without stitching together multiple tools.
        </p>
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <SectionCard title="Why makers choose Myrivo">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Variant-aware product catalog and inventory tracking</li>
            <li>Content workspace controls for home, product, about, policy, and cart pages</li>
            <li>Customer communication with notification and email tooling</li>
          </ul>
        </SectionCard>
        <SectionCard title="Get started">
          <p className="text-sm text-muted-foreground">Create your account and open your first storefront in minutes.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup"><Button>Start free</Button></Link>
            <Link href="/features"><Button variant="outline">View features</Button></Link>
          </div>
        </SectionCard>
      </section>
    </PageShell>
  );
}
