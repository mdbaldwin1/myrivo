import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsLayout } from "@/components/docs/docs-layout";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { OWNER_DOCS, getOwnerDocBySlug } from "@/lib/docs/content";

type DocDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return OWNER_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: DocDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getOwnerDocBySlug(slug);

  if (!doc) {
    return {
      title: "Documentation | Myrivo"
    };
  }

  return {
    title: `${doc.title} | Myrivo Docs`,
    description: doc.summary
  };
}

function toHeadingAnchorId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function DocDetailPage({ params }: DocDetailPageProps) {
  const { slug } = await params;
  const doc = getOwnerDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const docIndex = OWNER_DOCS.findIndex((entry) => entry.slug === doc.slug);
  const previousDoc = docIndex > 0 ? OWNER_DOCS[docIndex - 1] : null;
  const nextDoc = docIndex < OWNER_DOCS.length - 1 ? OWNER_DOCS[docIndex + 1] : null;

  return (
    <PageShell>
      <DocsLayout currentSlug={doc.slug}>
        <SectionCard title={doc.title} description={doc.summary}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Audience: {doc.audience}</span>
              <span>Owner: {doc.owner}</span>
              <span>Updated {doc.lastUpdated}</span>
              <span>Review cadence: {doc.reviewCadence}</span>
              <span>Next review: {doc.reviewByLabel}</span>
            </div>
            {doc.isReviewOverdue ? (
              <p className="text-xs font-medium text-amber-700">
                This guide is past its review date. Validate the workflow before relying on it operationally.
              </p>
            ) : null}
          </div>
          <div className="mt-4 space-y-6">
                {doc.sections.map((section) => (
                  <section key={section.heading} className="space-y-2">
                <h2 id={toHeadingAnchorId(section.heading)} className="scroll-mt-20 text-sm font-semibold text-foreground">
                  {section.heading}
                </h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets && section.bullets.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border/70 pt-4">
            <div>
              {previousDoc ? (
                <Link href={`/docs/${previousDoc.slug}`} className="text-sm text-muted-foreground hover:underline">
                  Previous: {previousDoc.title}
                </Link>
              ) : null}
            </div>
            <div>
              {nextDoc ? (
                <Link href={`/docs/${nextDoc.slug}`} className="text-sm text-muted-foreground hover:underline">
                  Next: {nextDoc.title}
                </Link>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </DocsLayout>
    </PageShell>
  );
}
