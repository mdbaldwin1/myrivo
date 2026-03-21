import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";

export const metadata: Metadata = {
  title: "Store builder for handmade products | Myrivo",
  description: "Launch a branded storefront for handmade products with checkout, fulfillment, and customer communication built in."
};

const highlights = [
  "A premium storefront for small-batch goods like tallow skincare, pottery, woodwork, apparel, and gifts.",
  "Built-in product pages, checkout, promos, reviews, and order workflows in one place.",
  "Start without a monthly subscription and only pay when orders come through."
];

export default function HandmadeProductsPage() {
  return (
    <MarketingSiteChrome activePath="/for">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Handmade Brands</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Build a beautiful online shop for handmade and small-batch products.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo is built for independent makers who want their own branded storefront without the usual pile of themes, plugins, and disconnected tools.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Why handmade sellers choose Myrivo</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">Launch your first storefront</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">Create your account, add products, set up fulfillment, and start selling from a shop that feels like your brand.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <MarketingTrackedButtonLink
              href="/signup"
              ctaKey="handmade_launch_start_free"
              ctaLabel="Start free"
              sectionKey="launch_card"
              conversionIntent="signup"
              className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
            >
              Start free
            </MarketingTrackedButtonLink>
            <MarketingTrackedButtonLink
              href="/features"
              ctaKey="handmade_launch_view_features"
              ctaLabel="View features"
              sectionKey="launch_card"
              variant="outline"
              className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
            >
              View features
            </MarketingTrackedButtonLink>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
