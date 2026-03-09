import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

export const metadata: Metadata = {
  title: "Multi-store commerce platform | Myrivo",
  description: "Operate multiple storefronts with governance, approvals, and role-based admin controls in Myrivo."
};

export default function MultiStoreCommercePage() {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <section className="space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-4xl font-semibold">Multi-store commerce platform</h1>
        <p className="text-sm text-muted-foreground">
          Manage store-level operations while maintaining platform-wide visibility, moderation, and policy governance.
        </p>
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <SectionCard title="Platform controls">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Admin workspace for approvals, moderation, and audit events</li>
            <li>Role-based access controls across stores and users</li>
            <li>Store status governance and readiness checks</li>
          </ul>
        </SectionCard>
        <SectionCard title="Get started">
          <p className="text-sm text-muted-foreground">Start with a free account and map your platform model to available controls.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup"><Button>Start free</Button></Link>
            <Link href="/compare"><Button variant="outline">Compare approaches</Button></Link>
          </div>
        </SectionCard>
      </section>
    </PageShell>
  );
}
