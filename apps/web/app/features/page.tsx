import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

const featureGroups = [
  {
    title: "Storefront and Brand",
    points: [
      "Branded storefront themes, logo/color controls, and content workspace customization.",
      "Product catalogs with variants, media support, policy pages, and review displays.",
      "Custom domains with white-label support and preview-safe routing."
    ]
  },
  {
    title: "Operations and Fulfillment",
    points: [
      "Order lifecycle management with packing slips, pick lists, and shipment updates.",
      "Pickup scheduling, blackout controls, location settings, and checkout enforcement.",
      "Inventory movement ledger and low-stock alerting for active products."
    ]
  },
  {
    title: "Growth and Retention",
    points: [
      "Promotions manager, discount previews, and email subscriber capture workflows.",
      "Configurable transactional email content and branded communication settings.",
      "Notification inbox with preferences for in-app and email delivery."
    ]
  },
  {
    title: "Platform and Governance",
    points: [
      "Multi-store workspace architecture with role-based access controls.",
      "Platform admin workspace for approvals, moderation, and audit event visibility.",
      "Store status governance, legal acceptance controls, and rollout safeguards."
    ]
  }
];

export default function FeaturesPage() {
  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product Features</p>
        <h1 className="text-4xl font-semibold">Everything needed to launch, operate, and scale storefronts on Myrivo.</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Myrivo combines storefront control, operations tooling, growth workflows, and platform governance in one system so teams can ship reliably without
          stitching together multiple vendors.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/signup">
            <Button>Create account</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline">View pricing</Button>
          </Link>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {featureGroups.map((group) => (
          <SectionCard key={group.title} title={group.title}>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {group.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </SectionCard>
        ))}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Need a platform walkthrough?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          For teams comparing platform architecture options, we can walk through store workspaces, admin controls, and migration considerations.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/compare">
            <Button variant="outline">Compare options</Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline">Read docs</Button>
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
