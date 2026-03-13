import type { MarketingAnalyticsSummary } from "@/lib/marketing/analytics-query";

type PlatformMarketingCtaTableProps = {
  summary: MarketingAnalyticsSummary;
};

export function PlatformMarketingCtaTable({ summary }: PlatformMarketingCtaTableProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-border/70 bg-background p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">CTA Performance</h2>
          <p className="text-xs text-muted-foreground">Track which public-site calls to action actually move visitors toward signup.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">CTA</th>
                <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Clicks</th>
                <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Signup starts</th>
                <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Signup completions</th>
                <th className="border-b border-border px-3 py-2 font-medium text-muted-foreground">Demo requests</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCta.map((row) => (
                <tr key={`${row.pageKey ?? "unknown"}:${row.sectionKey ?? "unknown"}:${row.ctaKey}`}>
                  <td className="border-b border-border/70 px-3 py-2 align-top">
                    <p className="font-medium text-foreground">{row.ctaLabel ?? row.ctaKey}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.pageKey ?? "unknown"} / {row.sectionKey ?? "unknown"} / {row.ctaKey}
                    </p>
                  </td>
                  <td className="border-b border-border/70 px-3 py-2">{row.clicks}</td>
                  <td className="border-b border-border/70 px-3 py-2">{row.signupStarts}</td>
                  <td className="border-b border-border/70 px-3 py-2">{row.signupCompletions}</td>
                  <td className="border-b border-border/70 px-3 py-2">{row.demoRequestStarts}</td>
                </tr>
              ))}
              {summary.byCta.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No CTA clicks have been tracked in this window yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Experiment Snapshot</h2>
          <p className="text-xs text-muted-foreground">Lightweight experiment assignments and conversion signal by variant.</p>
        </div>
        <div className="space-y-3">
          {summary.experiments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active experiment traffic has been recorded in this window yet.</p>
          ) : (
            summary.experiments.map((experiment) => (
              <div key={`${experiment.experimentKey}:${experiment.variantKey}`} className="rounded-lg border border-border/70 px-3 py-3 text-sm">
                <p className="font-medium text-foreground">
                  {experiment.experimentKey} · {experiment.variantKey}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {experiment.sessions} sessions · {experiment.signupStarts} signup starts · {experiment.signupCompletions} completions
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
