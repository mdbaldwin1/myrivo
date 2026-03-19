"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MarketingAnalyticsSummary } from "@/lib/marketing/analytics-query";

type PlatformMarketingTrendPanelProps = {
  summary: MarketingAnalyticsSummary;
};

export function PlatformMarketingTrendPanel({ summary }: PlatformMarketingTrendPanelProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Traffic and Signup Trend</h2>
          <p className="text-xs text-muted-foreground">Daily sessions and signup starts for the selected window.</p>
        </div>
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <LineChart data={summary.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="signupStarts" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Signup Completions</h2>
          <p className="text-xs text-muted-foreground">Completed signups by day so we can see funnel follow-through.</p>
        </div>
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <BarChart data={summary.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="signupCompletions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
