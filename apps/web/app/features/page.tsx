import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";

const featureGroups = [
  {
    title: "Storefront and Brand",
    points: [
      "Branded storefront themes with tokenized color/type controls and page-by-page content workspace.",
      "Product catalogs with variants, inventory, media galleries, reviews, and SEO schema output.",
      "Custom domain support with preview-safe routing and multi-environment launch controls."
    ]
  },
  {
    title: "Operations and Fulfillment Engine",
    points: [
      "Order lifecycle workflows with pick lists, packing slips, shipment states, and delivery updates.",
      "Pickup scheduling controls: locations, blackout dates, lead windows, and checkout gating.",
      "Inventory movement ledger, low-stock notifications, and variant-level stock control."
    ]
  },
  {
    title: "Growth and Customer Retention",
    points: [
      "Promotions manager with previewable discount behavior and redemption controls.",
      "Subscriber capture and configurable transactional email templates by store.",
      "In-app + email notification routing with per-user preferences."
    ]
  },
  {
    title: "Platform Controls and Governance",
    points: [
      "Store and platform workspaces with explicit role boundaries and scoped navigation.",
      "Admin controls for moderation, approvals, audit timeline, and incident response.",
      "Legal version acceptance tracking, rollout gates, and release readiness checks."
    ]
  }
];

export default function FeaturesPage() {
  return (
    <MarketingSiteChrome activePath="/features">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Product Surface</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Every critical workflow from storefront launch to platform governance.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo removes tool sprawl. You get one connected operating system that handles merchandising, checkout operations,
          customer communications, and compliance.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary">Create account</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10">
              View pricing
            </Button>
          </Link>
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
        <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-3xl">Need a workflow walkthrough?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--primary-foreground))]">
          Explore architecture, migration shape, and operator workflows before launch. Start with the compare page or dive into docs.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/compare">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Compare options
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
              Read docs
            </Button>
          </Link>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
