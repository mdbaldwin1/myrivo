"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";

type SubscriberRow = {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
};

type SubscribersResponse = {
  subscribers?: SubscriberRow[];
  summary?: {
    total: number;
    subscribed: number;
    unsubscribed: number;
  };
  error?: string;
};

export function StoreEmailSubscribersManager() {
  const [statusFilter, setStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);

  async function loadSubscribers() {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (statusFilter !== "all") {
      query.set("status", statusFilter);
    }
    const response = await fetch(`/api/stores/email-subscribers?${query.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as SubscribersResponse;
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Unable to load subscribers.");
      return;
    }
    setSubscribers(payload.subscribers ?? []);
  }

  useEffect(() => {
    void loadSubscribers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const summary = useMemo(
    () => ({
      total: subscribers.length,
      subscribed: subscribers.filter((entry) => entry.status === "subscribed").length,
      unsubscribed: subscribers.filter((entry) => entry.status === "unsubscribed").length
    }),
    [subscribers]
  );

  const exportParams = statusFilter === "all" ? "format=csv" : `format=csv&status=${statusFilter}`;

  return (
    <SectionCard
      title="Email Subscribers"
      action={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadSubscribers()} disabled={loading}>
            Refresh
          </Button>
          <a href={`/api/stores/email-subscribers?${exportParams}`}>
            <Button type="button" variant="outline" size="sm">
              Export CSV
            </Button>
          </a>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Total: {summary.total}</span>
          <span>Subscribed: {summary.subscribed}</span>
          <span>Unsubscribed: {summary.unsubscribed}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="email-subscriber-status-filter" className="text-muted-foreground">
            Filter
          </label>
          <select
            id="email-subscriber-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-9 rounded-md border border-border bg-background px-2"
          >
            <option value="all">All</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading subscribers...</p> : null}
        <FeedbackMessage type="error" message={error} />

        {!loading && !error ? (
          subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2">{row.source}</td>
                      <td className="px-3 py-2">{new Date(row.subscribed_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>
    </SectionCard>
  );
}
