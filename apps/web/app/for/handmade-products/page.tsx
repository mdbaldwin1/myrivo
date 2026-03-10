import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Store builder for handmade products | Myrivo",
  description: "Build a branded commerce experience for handmade products with order, inventory, and content workflows in Myrivo."
};

const highlights = [
  "Variant-aware catalog and inventory with media-rich product storytelling.",
  "Content workspace controls for home, products, about, policies, cart, and email flows.",
  "Customer communication with reviews, in-app notifications, and transactional email templates."
];

export default function HandmadeProductsPage() {
  return (
    <MarketingSiteChrome activePath="/for">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Handmade Brands</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Build a premium storefront for handcrafted products.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo helps independent makers look high-end online while keeping operations simple behind the scenes.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Why makers choose Myrivo</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">Launch your first store</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">Create your account, configure catalog + fulfillment, and publish with confidence.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">Start free</Button>
            </Link>
            <Link href="/features">
              <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
                View features
              </Button>
            </Link>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
