import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Handmade and small-batch storefronts | Myrivo",
  description: "Launch a branded storefront for handmade and small-batch products with checkout, fulfillment, promos, and seller operations in one platform."
};

const highlights = [
  "A branded storefront for skincare, pottery, woodwork, apparel, gifts, candles, and other small-batch goods.",
  "Product pages, checkout, promotions, reviews, and order flow in one connected system.",
  "Start without a monthly subscription, then pay when successful orders come through."
];

export default async function HandmadeProductsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/for" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Handmade Brands</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          A better storefront for handmade and small-batch brands.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo fits independent makers who care how the shop looks and want products, checkout, fulfillment, and day-to-day operations to stay
          manageable as orders grow.
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

        <article className="rounded-2xl border border-border bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary)))] p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">Launch without piecing together extra tools</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">
            Create your account, add products, set pickup or shipping, and publish from a storefront that feels like your brand.
          </p>
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
