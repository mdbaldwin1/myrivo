import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const featureGroups = [
  {
    title: "Storefront, Catalog, and Brand",
    points: [
      "Branded storefront themes with flexible color, typography, spacing, and layout controls.",
      "Product catalogs with variants, imagery, reviews, and richer product storytelling.",
      "Custom domain support so the shop lives on your brand, not a marketplace profile."
    ]
  },
  {
    title: "Orders, Fulfillment, and Pickup",
    points: [
      "Order workflows with pick lists, packing slips, shipment states, and delivery updates.",
      "Pickup scheduling controls with locations, blackout dates, lead windows, and checkout gating.",
      "Inventory tracking with low-stock visibility, variant-level stock control, and made-to-order support."
    ]
  },
  {
    title: "Sell, Retain, and Communicate",
    points: [
      "Promotions, discounts, and merchandising tools that are easy to preview before you publish them.",
      "Subscriber capture and store-owned transactional email templates tied to your storefront.",
      "Customer communication through reviews, order emails, and store notifications."
    ]
  },
  {
    title: "Operations That Stay Manageable",
    points: [
      "One connected workflow instead of a site builder plus apps plus checkout plugins.",
      "Clear setup flows for payments, tax handling, pickup, and shipping.",
      "Role-based controls for stores that need owners, staff, or platform oversight."
    ]
  }
];

export default async function FeaturesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/features" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise relative overflow-hidden py-8 sm:py-12 lg:py-16">
        <div className="relative max-w-4xl">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Features</p>
          <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-[1.04] text-foreground sm:text-6xl">
            Everything you need to launch and run a product shop in one place.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            Myrivo brings storefront, products, checkout, fulfillment, promotions, reviews, and seller operations into one system so small product
            brands can run the whole shop without piecing together extra tools.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
              className="h-11 rounded-full border-[hsl(var(--primary))]/30 bg-white/70 px-6 text-[hsl(var(--primary))] hover:bg-white"
            >
              View pricing
            </MarketingTrackedButtonLink>
          </div>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-14 grid gap-8 md:grid-cols-2">
        {featureGroups.map((group) => (
          <article key={group.title} className="rounded-[1.9rem] bg-white/62 p-6 shadow-[0_16px_44px_rgba(20,35,28,0.04)] backdrop-blur-sm sm:p-8">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl leading-tight text-foreground">{group.title}</h2>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">
              {group.points.map((point) => (
                <li key={point} className="border-t border-border/60 pt-4">
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-24 rounded-[2.35rem] bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary)))] p-8 text-primary-foreground shadow-[0_28px_80px_rgba(63,58,122,0.24)] sm:mt-28 sm:p-10">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight sm:text-4xl">
          Want to see where this platform fits best?
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[hsl(var(--primary-foreground))]">
          Explore the use-case pages or compare Myrivo to marketplaces, generic store builders, and stitched-together selling stacks.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/for/handmade-products">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/45 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Explore use cases
            </Button>
          </Link>
          <Link href="/compare">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/45 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Compare approaches
            </Button>
          </Link>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
