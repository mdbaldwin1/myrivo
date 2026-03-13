import Link from "next/link";
import type { Metadata } from "next";
import { DocsLayout } from "@/components/docs/docs-layout";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getOwnerDocsByCategory } from "@/lib/docs/content";

export const metadata: Metadata = {
  title: "Documentation | Myrivo",
  description: "Documentation for store owners and staff using Myrivo."
};

export default function DocsIndexPage() {
  const categories = getOwnerDocsByCategory();

  return (
    <PageShell>
      <DocsLayout>
        <SectionCard title="Documentation" description="Guides for store owners and staff using Myrivo.">
          <div className="space-y-5">
            {categories.map((entry) => (
              <section key={entry.category} className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">{entry.category}</h2>
                <ul className="space-y-2">
                  {entry.docs.map((doc) => (
                    <li key={doc.slug} className="rounded-md border border-border/70 bg-card px-3 py-3">
                      <Link href={`/docs/${doc.slug}`} className="text-sm font-medium hover:underline">
                        {doc.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{doc.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Audience: {doc.audience}</span>
                        <span>Owner: {doc.owner}</span>
                        <span>Review cadence: {doc.reviewCadence}</span>
                        <span>Next review: {doc.reviewByLabel}</span>
                        {doc.isReviewOverdue ? <span className="font-medium text-amber-700">Review overdue</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </SectionCard>
      </DocsLayout>
    </PageShell>
  );
}
