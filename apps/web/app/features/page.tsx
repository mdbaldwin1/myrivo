import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { Button } from "@/components/ui/button";

const featureGroups = [
  {
    title: "Your Storefront and Brand",
    points: [
      "Branded storefront themes with flexible color and typography controls.",
      "Product catalogs with variants, inventory, images, reviews, and product storytelling.",
      "Custom domain support so your shop feels like your brand from day one."
    ]
  },
  {
    title: "Products, Orders, and Fulfillment",
    points: [
      "Order workflows with pick lists, packing slips, shipment states, and delivery updates.",
      "Pickup scheduling controls with locations, blackout dates, lead windows, and checkout gating.",
      "Inventory tracking with low-stock visibility and variant-level stock control."
    ]
  },
  {
    title: "Sell and Bring Customers Back",
    points: [
      "Promotions and discount tools that are easy to preview before you publish them.",
      "Subscriber capture and transactional email templates tied to your store.",
      "Customer communication through reviews, order emails, and store notifications."
    ]
  },
  {
    title: "Built To Be Easier To Run",
    points: [
      "One connected workflow instead of stitching together a site builder, checkout plugins, and fulfillment tools.",
      "Clear setup flows for payments, tax handling, pickup, and shipping.",
      "Role-based controls for stores that need owners, staff, or platform oversight."
    ]
  }
];

export default function FeaturesPage() {
  return (
    <MarketingSiteChrome activePath="/features">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Features</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Everything you need to launch and run a product shop in one place.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo gives handmade sellers and small product brands a branded storefront, built-in checkout, fulfillment workflows,
          and customer communication without the usual patchwork of extra tools.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <MarketingTrackedButtonLink
            href="/signup"
            ctaKey="features_hero_create_account"
            ctaLabel="Create account"
            sectionKey="hero"
            conversionIntent="signup"
            className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary"
          >
            Create account
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/pricing"
            ctaKey="features_hero_view_pricing"
            ctaLabel="View pricing"
            sectionKey="hero"
            variant="outline"
            className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10"
          >
            View pricing
          </MarketingTrackedButtonLink>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-2">
        {featureGroups.map((group) => (
          <article key={group.title} className="rounded-2xl border border-border bg-white p-6">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {group.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-6 rounded-3xl border border-border bg-primary p-8 text-primary-foreground">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl">Want to see how it fits your kind of shop?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--primary-foreground))]">
          Start with the handmade-products page or compare Myrivo to the usual mix of marketplaces, store builders, and stitched-together tools.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/for/handmade-products">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Explore handmade selling
            </Button>
          </Link>
          <Link href="/compare">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Compare approaches
            </Button>
          </Link>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
