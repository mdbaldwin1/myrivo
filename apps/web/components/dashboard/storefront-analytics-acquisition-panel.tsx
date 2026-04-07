import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StorefrontAnalyticsSummary } from "@/lib/analytics/query";
import { StorefrontShareLinkBuilder } from "@/components/dashboard/storefront-share-link-builder";

type StorefrontAnalyticsAcquisitionPanelProps = {
  summary: StorefrontAnalyticsSummary;
  storeSlug: string;
  appUrl: string;
  primaryDomain?: string | null;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

type AcquisitionBreakdownTableProps = {
  title: string;
  description: string;
  rows: Array<{ label: string; sessions: number; share: number }>;
  emptyLabel: string;
};

function AcquisitionBreakdownTable({ title, description, rows, emptyLabel }: AcquisitionBreakdownTableProps) {
  return (
    <article className="overflow-hidden rounded-md border border-border/70 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Sessions</th>
                <th className="px-4 py-2">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={`${title}-${row.label}`}>
                  <td className="px-4 py-2 font-medium">{row.label}</td>
                  <td className="px-4 py-2">{row.sessions}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatPercent(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </article>
  );
}

export function StorefrontAnalyticsAcquisitionPanel({ summary, storeSlug, appUrl, primaryDomain }: StorefrontAnalyticsAcquisitionPanelProps) {
  return (
    <SectionCard
      title="Acquisition"
      description="First-touch attribution for shopper sessions in the selected analytics window."
    >
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-3">
          <DataStat label="External Referrer Sessions" value={String(summary.acquisition.externalReferrerSessions)} className="bg-card" />
          <DataStat label="Campaign Tagged Sessions" value={String(summary.acquisition.campaignTaggedSessions)} className="bg-card" />
          <DataStat label="Direct Sessions" value={String(summary.acquisition.directSessions)} className="bg-card" />
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <AcquisitionBreakdownTable
            title="Top Referrers"
            description="External domains that first sent shoppers into this storefront."
            rows={summary.acquisition.topReferrers}
            emptyLabel="No external referrers were captured in this range."
          />
          <AcquisitionBreakdownTable
            title="Top Sources"
            description="Top first-touch UTM sources from tagged campaign traffic."
            rows={summary.acquisition.topSources}
            emptyLabel="No UTM sources were captured in this range."
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <AcquisitionBreakdownTable
            title="Top Mediums"
            description="Top first-touch UTM mediums from tagged campaign traffic."
            rows={summary.acquisition.topMediums}
            emptyLabel="No UTM mediums were captured in this range."
          />
          <AcquisitionBreakdownTable
            title="Top Campaigns"
            description="Top first-touch UTM campaigns attributed to shopper sessions."
            rows={summary.acquisition.topCampaigns}
            emptyLabel="No UTM campaigns were captured in this range."
          />
        </section>

        <StorefrontShareLinkBuilder storeSlug={storeSlug} appUrl={appUrl} primaryDomain={primaryDomain} />
      </div>
    </SectionCard>
  );
}
