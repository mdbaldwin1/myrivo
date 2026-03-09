import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

export const metadata: Metadata = {
  title: "Local pickup order software | Myrivo",
  description: "Manage local pickup windows, location options, and checkout behavior for local commerce on Myrivo."
};

export default function LocalPickupOrdersPage() {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-4xl font-semibold">Local pickup order software</h1>
        <p className="text-sm text-muted-foreground">
          Configure pickup locations, time windows, radius behavior, and customer communication from one workflow.
        </p>
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <SectionCard title="Pickup workflows">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Buyer-select or hidden-nearest pickup modes</li>
            <li>Hours, blackout dates, and eligibility radius controls</li>
            <li>Order-level pickup metadata and operational visibility</li>
          </ul>
        </SectionCard>
        <SectionCard title="Get started">
          <p className="text-sm text-muted-foreground">Launch pickup-ready checkout with clear policy and communication controls.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup"><Button>Start free</Button></Link>
            <Link href="/docs/getting-started"><Button variant="outline">Read setup docs</Button></Link>
          </div>
        </SectionCard>
      </section>
    </PageShell>
  );
}
