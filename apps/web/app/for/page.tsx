import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const useCases = [
  {
    href: "/for/handmade-products",
    title: "Handmade and small-batch product brands",
    description: "Best if your products need stronger brand presentation than a marketplace listing or generic theme can usually give you."
  },
  {
    href: "/for/local-pickup-orders",
    title: "Sellers who rely on local pickup",
    description: "Best if pickup windows, location rules, and clear handoff communication are core parts of how you fulfill orders."
  },
  {
    href: "/for/multi-store-commerce",
    title: "Teams operating multiple stores",
    description: "Best if one team needs approvals, moderation, role controls, and governance across multiple store operators."
  }
];

export default async function SolutionsIndexPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/for" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise relative overflow-hidden py-8 sm:py-12 lg:py-16">
        <div className="relative max-w-4xl">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Use Cases</p>
          <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-[1.04] text-foreground sm:text-6xl">
            One platform, shown through the selling situations it fits best.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            Myrivo is one platform with storefront, checkout, fulfillment, promotions, reviews, and seller operations in the same system. These examples
            show the kinds of selling situations where that one platform tends to fit especially well.
          </p>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-14 grid gap-6 md:grid-cols-3">
        {useCases.map((useCase, index) => (
          <article
            key={useCase.href}
            className={
              index === 1
                ? "flex h-full flex-col rounded-[1.95rem] bg-[linear-gradient(180deg,rgba(94,70,143,0.08),rgba(46,157,152,0.06),rgba(255,255,255,0.92))] p-6 shadow-[0_18px_46px_rgba(20,35,28,0.05)] sm:p-7"
                : "flex h-full flex-col rounded-[1.95rem] bg-white/64 p-6 shadow-[0_18px_46px_rgba(20,35,28,0.05)] backdrop-blur-sm sm:p-7"
            }
          >
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Best fit</p>
            <h2 className="mt-3 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl leading-tight text-foreground">{useCase.title}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{useCase.description}</p>
            <div className="mt-auto border-t border-border/60 pt-4">
              <MarketingTrackedButtonLink
                href={useCase.href}
                ctaKey={`solutions_grid_${useCase.href.split("/").at(-1) ?? "detail"}`}
                ctaLabel={`Open ${useCase.title}`}
                sectionKey="solutions_grid"
                variant="outline"
                size="sm"
                className="rounded-full border-[hsl(var(--brand-secondary))]/30 bg-white/70 text-[hsl(var(--brand-secondary))] hover:bg-[hsl(var(--brand-secondary))]/10"
              >
                See this fit
              </MarketingTrackedButtonLink>
            </div>
          </article>
        ))}
      </section>
    </MarketingSiteChrome>
  );
}
