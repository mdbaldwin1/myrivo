import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";

const comparisonRows = [
  {
    area: "Storefront control",
    myrivo: "Built-in content workspace, theming tokens, and storefront route architecture.",
    alternatives: "Often split across separate CMS + commerce stacks."
  },
  {
    area: "Operations",
    myrivo: "Integrated order, inventory, pickup, and shipping lifecycle tooling.",
    alternatives: "Requires combining multiple plugins or external systems."
  },
  {
    area: "Multi-store platform controls",
    myrivo: "Native store hub/admin workspace for approvals, moderation, and governance.",
    alternatives: "Usually custom implementation outside core product."
  },
  {
    area: "Notification and communication",
    myrivo: "Unified in-app + email notification model with owner/customer targeting.",
    alternatives: "Fragmented event delivery and less predictable routing."
  },
  {
    area: "Compliance and auditability",
    myrivo: "Audit events, legal version acceptance tracking, and policy guardrails.",
    alternatives: "Frequently manual and inconsistent across tools."
  }
];

export default function ComparePage() {
  return (
    <MarketingSiteChrome activePath="/compare">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Comparison</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Myrivo vs. stitched-together commerce stacks
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo is designed for teams that want one operating system for storefront, fulfillment, growth, and governance instead of a fragile chain of tools.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4">
        {comparisonRows.map((row) => (
          <article key={row.area} className="rounded-2xl border border-border bg-white p-5">
            <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">{row.area}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-accent/30 bg-[hsl(var(--muted))] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground">Myrivo</p>
                <p className="mt-1 text-sm text-foreground">{row.myrivo}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Typical alternatives</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.alternatives}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="marketing-rise marketing-delay-2 mt-6 rounded-3xl border border-border bg-primary p-8 text-primary-foreground">
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl">Next step</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--primary-foreground))]">
          If you are evaluating platform fit for your team, start with a free account and then map operational requirements in the docs.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <MarketingTrackedButtonLink
            href="/signup"
            ctaKey="compare_next_create_account"
            ctaLabel="Create account"
            sectionKey="next_step"
            conversionIntent="signup"
            className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
          >
            Create account
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/features"
            ctaKey="compare_next_explore_features"
            ctaLabel="Explore features"
            sectionKey="next_step"
            variant="outline"
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            Explore features
          </MarketingTrackedButtonLink>
          <MarketingTrackedButtonLink
            href="/docs"
            ctaKey="compare_next_open_docs"
            ctaLabel="Open docs"
            sectionKey="next_step"
            variant="outline"
            className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
          >
            Open docs
          </MarketingTrackedButtonLink>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
