import type { MarketingAnalyticsSummary } from "@/lib/marketing/analytics-query";

type PlatformMarketingPageTableProps = {
  summary: MarketingAnalyticsSummary;
};

export function PlatformMarketingPageTable({ summary }: PlatformMarketingPageTableProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-background p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Conversion by Page</h2>
        <p className="text-xs text-muted-foreground">Landing-page and page-level performance for public-site conversion paths.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Page</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Sessions</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Page views</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">CTA clicks</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Signup starts</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Signup completions</th>
              <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Demo requests</th>
            </tr>
          </thead>
          <tbody>
            {summary.byPage.map((row) => (
              <tr key={row.pageKey}>
                <td className="border-b border-border/70 px-3 py-2 align-top">
                  <p className="font-medium text-foreground">{row.pageKey}</p>
                  {row.entryPath ? <p className="text-xs text-muted-foreground">{row.entryPath}</p> : null}
                </td>
                <td className="border-b border-border/70 px-3 py-2">{row.sessions}</td>
                <td className="border-b border-border/70 px-3 py-2">{row.pageViews}</td>
                <td className="border-b border-border/70 px-3 py-2">{row.ctaClicks}</td>
                <td className="border-b border-border/70 px-3 py-2">{row.signupStarts}</td>
                <td className="border-b border-border/70 px-3 py-2">{row.signupCompletions}</td>
                <td className="border-b border-border/70 px-3 py-2">{row.demoRequestStarts}</td>
              </tr>
            ))}
            {summary.byPage.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No marketing traffic has been tracked in this window yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
