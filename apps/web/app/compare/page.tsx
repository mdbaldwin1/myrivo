import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

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
    <PageShell maxWidthClassName="max-w-6xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comparison</p>
        <h1 className="text-4xl font-semibold">Myrivo vs pieced-together commerce stacks</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Myrivo is designed for teams that want one operating system for storefront, fulfillment, growth, and governance instead of a fragile chain of tools.
        </p>
      </section>

      <section className="mt-4 grid gap-3">
        {comparisonRows.map((row) => (
          <SectionCard key={row.area} title={row.area}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Myrivo</p>
                <p className="mt-1 text-sm text-emerald-900">{row.myrivo}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Typical alternatives</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.alternatives}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Next step</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If you are evaluating platform fit for your team, start with a free account and then map operational requirements in the docs.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/signup">
            <Button>Create account</Button>
          </Link>
          <Link href="/features">
            <Button variant="outline">Explore features</Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline">Open docs</Button>
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
