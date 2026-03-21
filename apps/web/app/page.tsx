import { HomepagePrimaryCta } from "@/components/marketing/homepage-primary-cta";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-7 shadow-[0_30px_70px_rgba(29,51,23,0.08)] sm:p-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">Made for product sellers</span>
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">Custom storefront included</span>
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">Only pay when you earn</span>
        </div>
        <h1 className="mt-5 max-w-4xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-6xl">
          Build a custom storefront for your products and start selling in minutes.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Myrivo helps handmade sellers, boutique brands, and small product businesses launch a polished online shop without piecing together a
          website, checkout, and fulfillment workflow from scratch. You only pay when you earn.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <HomepagePrimaryCta isAuthenticated={isAuthenticated} />
          <MarketingTrackedButtonLink
            href="/pricing"
            ctaKey="home_hero_see_pricing"
            ctaLabel="See pricing"
            sectionKey="hero"
            variant="outline"
            className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10"
          >
            See pricing
          </MarketingTrackedButtonLink>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">A Store That Feels Like Yours</p>
          <p className="mt-2 text-sm text-foreground">Create a premium branded shop for skincare, pottery, wood goods, apparel, and other small-batch products.</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Selling Without The Tool Sprawl</p>
          <p className="mt-2 text-sm text-foreground">Products, checkout, pickup, shipping, reviews, promos, and order management live in one place.</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pricing That Starts Light</p>
          <p className="mt-2 text-sm text-foreground">Start without a monthly subscription and pay a simple fee only when orders come through.</p>
        </article>
      </section>

      <section className="marketing-rise marketing-delay-2 mt-8 rounded-3xl border border-border bg-primary p-8 text-primary-foreground sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">How sellers use Myrivo</p>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">01</p>
            <p className="mt-2 text-base font-semibold">Launch your shop fast</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Start with a branded storefront, add products, configure fulfillment, and publish when you are ready.</p>
          </div>
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">02</p>
            <p className="mt-2 text-base font-semibold">Keep fulfillment simple</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Handle pickup, shipping, inventory changes, and order updates without stitching together extra tools.</p>
          </div>
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">03</p>
            <p className="mt-2 text-base font-semibold">Grow at your pace</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Only pay when you make sales, and keep your storefront, brand, and customer experience under your control.</p>
          </div>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
