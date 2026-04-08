import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HomepagePrimaryCta } from "@/components/marketing/homepage-primary-cta";
import { MarketingHomepageStorefrontPreview } from "@/components/marketing/marketing-homepage-storefront-preview";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { MarketingFeaturedStores, type FeaturedStoreData } from "@/components/marketing/marketing-featured-stores";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { formatMoney, formatMoneyWithCents, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontHomePath } from "@/lib/storefront/paths";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const proofPoints = [
  "Branded storefront included",
  "Products, checkout, fulfillment, and promos together",
  "No monthly subscription to start"
];

const productMoments = [
  {
    label: "Brand",
    title: "A storefront that looks like your business, not a generic theme.",
    body: "Set the look, copy, navigation, featured products, and policy details in one place so the store feels consistent from the first visit."
  },
  {
    label: "Operations",
    title: "Products, inventory, checkout, and fulfillment stay connected.",
    body: "Manage variants, inventory, promotions, pickup or shipping setup, and order flow without stitching together extra tools."
  },
  {
    label: "Launch",
    title: "Start with one platform and keep improving as you grow.",
    body: "Launch on the current public plan, refine the storefront over time, and keep seller operations in the same system as orders come through."
  }
];

const screenshots = [
  {
    eyebrow: "Storefront preview",
    title: "Brand story, announcement, and navigation stay aligned",
    imageSrc: "/marketing/screenshots/homepage-storefront-preview.jpg",
    imageAlt: "At Home Apothecary storefront landing page with a branded header, announcement bar, navigation, hero copy, and trust messaging.",
    imageClassName: "object-left-top",
    lines: [
      "Announcement bar and top navigation stay on-brand",
      "Hero copy and calls to action match the storefront theme",
      "Trust cues and collection paths stay visible above the fold"
    ]
  },
  {
    eyebrow: "Seller workspace",
    title: "Product setup, pricing, and catalog status stay in one workflow",
    imageSrc: "/marketing/screenshots/homepage-seller-workspace.jpg",
    imageAlt: "Myrivo product editor flyout over the catalog workspace, showing title, description, and catalog inventory details.",
    imageClassName: "object-right-top",
    lines: [
      "Title, rich product copy, and imagery are edited together",
      "Status, price, inventory, and variant counts stay visible in the catalog",
      "Store updates are managed from the same seller workspace"
    ]
  },
  {
    eyebrow: "Order flow",
    title: "Orders keep the customer and fulfillment context in view",
    imageSrc: "/marketing/screenshots/homepage-order-flow.jpg",
    imageAlt: "Myrivo order detail flyout showing customer email, fulfillment method, shipping choice, totals, and order status.",
    imageClassName: "object-right-top",
    lines: [
      "Customer email, payment status, and totals live in one panel",
      "Fulfillment method, shipping choice, and fee details stay together",
      "Post-purchase order status stays attached to the same record"
    ]
  }
];

const launchSteps = [
  {
    step: "01",
    title: "Set the brand direction",
    body: "Start with your storefront look, tone, navigation, and merchandising so the public experience feels intentional from day one."
  },
  {
    step: "02",
    title: "Load products and fulfillment",
    body: "Add products, variants, pickup or shipping rules, and the practical details customers need before they buy."
  },
  {
    step: "03",
    title: "Publish and keep improving",
    body: "Launch a real store, then keep tuning the storefront and operations as orders start coming in."
  }
];

const pricingReasons = [
  {
    label: "Lower upfront risk",
    body: "Start with a branded storefront before you are ready to commit to another fixed monthly platform cost."
  },
  {
    label: "Aligned with growth",
    body: "The platform cost grows with real order volume instead of showing up before the store has traction."
  }
];

async function loadFeaturedStores(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<FeaturedStoreData[]> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id,name,slug,status")
    .eq("is_featured", true)
    .in("status", ["live", "offline"])
    .order("created_at", { ascending: false })
    .limit(4);

  if (!stores || stores.length === 0) {
    return [];
  }

  const storeIds = stores.map((store) => store.id);

  const [{ data: brandings }, { data: settings }, { data: products }] = await Promise.all([
    supabase
      .from("store_branding")
      .select("store_id,logo_path,primary_color,accent_color")
      .in("store_id", storeIds),
    supabase
      .from("store_settings")
      .select("store_id,footer_tagline,seo_description")
      .in("store_id", storeIds),
    supabase
      .from("products")
      .select("id,store_id,title,image_urls,price_cents,is_featured")
      .in("store_id", storeIds)
      .eq("status", "active")
      .eq("is_featured", true)
      .limit(12)
  ]);

  const brandingByStoreId = new Map((brandings ?? []).map((b) => [b.store_id, b]));
  const settingsByStoreId = new Map((settings ?? []).map((s) => [s.store_id, s]));
  const productsByStoreId = new Map<string, typeof products>();
  for (const product of products ?? []) {
    const existing = productsByStoreId.get(product.store_id) ?? [];
    existing.push(product);
    productsByStoreId.set(product.store_id, existing);
  }

  return stores.map((store) => {
    const branding = brandingByStoreId.get(store.id);
    const storeSettings = settingsByStoreId.get(store.id);
    const storeProducts = (productsByStoreId.get(store.id) ?? []).slice(0, 3);

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logo_path: branding?.logo_path ?? null,
      primary_color: branding?.primary_color ?? null,
      accent_color: branding?.accent_color ?? null,
      tagline: storeSettings?.footer_tagline?.trim() || storeSettings?.seo_description?.trim() || null,
      products: storeProducts.map((product) => ({
        id: product.id,
        title: product.title,
        image_url: (product.image_urls as string[] | null)?.[0] ?? null,
        price_cents: product.price_cents
      }))
    };
  });
}

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  if (requestedStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontHomePath(requestedStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
  }

  const redirectUrl = await resolveStorefrontCanonicalRedirect("/", requestedStoreSlug);
  if (redirectUrl) {
    redirect(redirectUrl);
  }

  const storefrontData = await loadStorefrontData(requestedStoreSlug);
  if (storefrontData) {
    const runtime = createStorefrontRuntime({
      ...storefrontData,
      mode: "live",
      surface: "home"
    });

    return (
      <StorefrontRuntimeProvider runtime={runtime}>
        <StorefrontPage
          store={storefrontData.store}
          viewer={storefrontData.viewer}
          branding={storefrontData.branding}
          settings={storefrontData.settings}
          contentBlocks={storefrontData.contentBlocks}
          products={storefrontData.products}
          view="home"
          reviewsEnabled={isReviewsEnabledForStoreSlug(storefrontData.store.slug)}
        />
      </StorefrontRuntimeProvider>
    );
  }

  const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
  if (unavailable) {
    return <StorefrontUnavailablePage state={unavailable} />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: planRows } = await supabase
    .from("billing_plans")
    .select("key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents,active,feature_flags_json")
    .order("monthly_price_cents", { ascending: true });
  const isAuthenticated = Boolean(user?.id);
  const plans = resolvePricingPlans((planRows as BillingPlanRow[] | null) ?? null);
  const standardPlan = plans[0] ?? null;
  const publicPlanName = standardPlan?.name ?? "Standard";
  const monthlyPriceLabel = standardPlan ? formatMoney(standardPlan.monthlyPriceCents) : "$0";
  const feeLabel = standardPlan ? `${formatPlatformFeePercent(standardPlan.feeBps)} + ${formatMoneyWithCents(standardPlan.feeFixedCents)}` : "6.00% + $0.30";

  const featuredStores = await loadFeaturedStores(supabase);

  const sellerFit = [
    {
      title: "Made for small product brands",
      body: "A strong fit for skincare, candles, pottery, apparel, gifts, apothecary goods, and other small-batch products where storefront presentation matters."
    },
    {
      title: "Pickup or shipping built in",
      body: "Offer local pickup or shipping from the same checkout, with the order details ready for fulfillment once the purchase goes through."
    },
    {
      title: "One public plan to start",
      body: `Start on ${publicPlanName} at ${monthlyPriceLabel} monthly, then pay ${feeLabel} per successful order with Stripe processing included.`
    }
  ];

  return (
    <MarketingSiteChrome activePath="/" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise relative overflow-hidden py-8 sm:py-12 lg:py-16">
        <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="rounded-full border border-[hsl(var(--brand-secondary))]/15 bg-white/80 px-3 py-1.5">Made for product sellers</span>
              <span className="rounded-full border border-[hsl(var(--brand-secondary))]/15 bg-white/80 px-3 py-1.5">Pickup or shipping built in</span>
              <span className="rounded-full border border-[hsl(var(--brand-secondary))]/15 bg-white/80 px-3 py-1.5">One public plan</span>
            </div>

            <h1 className="mt-7 max-w-4xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Build a storefront that feels like your brand, not a template.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Myrivo gives small product brands one connected platform for storefront, checkout, products, fulfillment, promotions, and seller
              operations. Customers get a stronger buying experience, and sellers get a calmer way to run the store behind it.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <HomepagePrimaryCta isAuthenticated={isAuthenticated} />
              <MarketingTrackedButtonLink
                href="/pricing"
                ctaKey="home_hero_see_pricing"
                ctaLabel="See pricing"
                sectionKey="hero"
                variant="outline"
                className="h-11 rounded-full border-[hsl(var(--primary))]/25 bg-white/75 px-6 text-[hsl(var(--primary))] hover:bg-white"
              >
                See pricing
              </MarketingTrackedButtonLink>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {proofPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/70 bg-white/72 px-4 py-4 text-sm font-medium text-foreground shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <MarketingHomepageStorefrontPreview />
          </div>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-16 grid gap-6 lg:grid-cols-3">
        {sellerFit.map((item) => (
          <article key={item.title} className="rounded-[1.75rem] bg-white/62 p-6 shadow-[0_14px_38px_rgba(20,35,28,0.04)] backdrop-blur-sm sm:p-7">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.title}</p>
            <p className="mt-4 max-w-sm border-t border-border/60 pt-4 text-base leading-8 text-foreground/88">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-1 mt-20 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch">
        <article className="flex h-full flex-col p-2 sm:p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">What makes it different</p>
          <h2 className="mt-4 max-w-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-foreground sm:text-4xl">
            More polished than a starter stack, less heavy than a full custom build.
          </h2>
          <div className="mt-8 space-y-6">
            {productMoments.map((item) => (
              <div key={item.title} className="grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--brand-secondary))]">{item.label}</p>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-[15px]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="flex h-full flex-col rounded-[2.25rem] bg-[linear-gradient(155deg,hsl(var(--primary)),hsl(var(--brand-secondary))_58%,hsl(var(--accent)))] p-7 text-primary-foreground shadow-[0_28px_80px_rgba(63,58,122,0.28)] sm:p-9">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">Pricing that starts light</p>
          <h2 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight sm:text-4xl">
            Launch without a monthly subscription, then pay when orders come through.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-[hsl(var(--primary-foreground))]">
            {publicPlanName} starts at {monthlyPriceLabel} monthly, then charges {feeLabel} per successful order. Stripe processing is already included,
            so sellers see one clearer fee model from the start.
          </p>
          <div className="mt-8 space-y-5">
            <div className="border-t border-white/20 pt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">Included from day one</p>
              <p className="mt-3 text-lg font-semibold">Storefront and seller workflow stay in the same plan.</p>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground))]">
                The current public plan includes the branded storefront, product setup, checkout, fulfillment, promotions, reviews, and day-to-day
                seller tools without splitting them into separate products.
              </p>
            </div>
            <div className="border-t border-white/20 pt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">Who it fits best</p>
              <p className="mt-3 text-sm leading-6 text-[hsl(var(--primary-foreground))]">
                Sellers who want a better-looking storefront and a calmer operations setup before they are ready for a large custom commerce investment.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {pricingReasons.map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-[hsl(var(--primary-foreground))]">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground))]">{item.body}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="marketing-rise marketing-delay-2 mt-24 bg-transparent sm:mt-28">
        <div className="max-w-4xl bg-transparent">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">What the product looks like</p>
          <h2 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-foreground sm:text-4xl">
            A storefront up front, with the seller workflow right behind it.
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            The storefront preview shows the customer-facing side. These panels show the seller side too: product setup, merchandising, and order flow
            using the same product and order data.
          </p>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {screenshots.map((shot) => (
            <article key={shot.title} className="overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,248,247,0.72))]">
              <div className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">{shot.eyebrow}</p>
                <h3 className="mt-2 text-xl font-semibold leading-tight text-foreground">{shot.title}</h3>
              </div>
              <div className="space-y-4 p-5">
                <div className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Real product screenshot</span>
                  </div>
                  <div className="relative aspect-[16/10] bg-[hsl(var(--muted))]">
                    <Image src={shot.imageSrc} alt={shot.imageAlt} fill className={`object-cover ${shot.imageClassName}`} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw" />
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {shot.lines.map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[hsl(var(--brand-secondary))]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MarketingFeaturedStores stores={featuredStores} />

      <section className="marketing-rise marketing-delay-2 mt-20 rounded-[2.5rem] bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary))_62%,hsl(var(--accent)))] p-8 text-primary-foreground shadow-[0_34px_90px_rgba(70,61,134,0.26)] sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">How sellers launch</p>
            <h2 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight sm:text-4xl">
              A clearer path from idea to live storefront.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[hsl(var(--primary-foreground))]">
              Set the storefront direction first, load products and fulfillment next, then keep improving from the same system once orders begin coming
              through.
            </p>
          </div>

          <div className="grid gap-4">
            {launchSteps.map((item) => (
              <div key={item.step} className="border-t border-white/20 pt-5">
                <p className="text-sm font-semibold tracking-[0.18em] text-[hsl(var(--primary-foreground))]">{item.step}</p>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[hsl(var(--primary-foreground))]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-2 mt-20 rounded-[2rem] bg-white/58 px-6 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-8 sm:py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ready to try it</p>
            <h2 className="mt-3 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl leading-tight text-foreground sm:text-4xl">
              Start with a better-looking storefront and a more connected selling workflow.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Myrivo is for sellers who want to launch, fulfill, and keep improving the store from one calmer workflow instead of juggling separate
              site, checkout, and operations tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <HomepagePrimaryCta isAuthenticated={isAuthenticated} />
            <MarketingTrackedButtonLink
              href="/features"
              ctaKey="home_bottom_explore_features"
              ctaLabel="Explore features"
              sectionKey="footer_cta"
              variant="outline"
              className="h-11 rounded-full px-6"
            >
              Explore features
            </MarketingTrackedButtonLink>
          </div>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
