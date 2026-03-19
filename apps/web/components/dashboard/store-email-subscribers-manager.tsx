"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";

type SubscriberRow = {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  message_type: "marketing";
  source: string;
  consent_source: string;
  consent_location: string | null;
  consent_captured_at: string;
  suppression_reason: string | null;
  suppression_recorded_at: string | null;
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
    messageType?: "marketing";
  };
  compliance?: {
    messageType: "marketing";
    fromAddress: string;
    fromMode: "platform_sender";
    senderDisplayName: string;
    replyToEmail: string | null;
    supportEmail: string | null;
    unsubscribeHref: string;
    privacyPolicyHref: string;
    privacyRequestHref: string;
    footerAddress: string | null;
    readiness: {
      status: "ready" | "attention_required";
      warnings: string[];
    };
  };
  error?: string;
};

export function StoreEmailSubscribersManager() {
  const [statusFilter, setStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [compliance, setCompliance] = useState<SubscribersResponse["compliance"] | null>(null);

  const loadSubscribers = useCallback(async () => {
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
    setCompliance(payload.compliance ?? null);
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSubscribers();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSubscribers]);

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
      title="Email Subscriber List"
      description="Review captured email subscribers, filter by subscription status, and export the current view."
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
        {compliance?.readiness.warnings.length ? (
          <div className="space-y-2">
            {compliance.readiness.warnings.map((warning) => (
              <AppAlert key={warning} variant="warning" compact message={warning} />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Message type: marketing</span>
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
                    <th className="px-3 py-2 font-medium">Message type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Consent source</th>
                    <th className="px-3 py-2 font-medium">Suppression</th>
                    <th className="px-3 py-2 font-medium">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2 capitalize">{row.message_type}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <p>{row.consent_source}</p>
                          {row.consent_location ? <p className="text-xs text-muted-foreground">{row.consent_location}</p> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.suppression_reason ? (
                          <div className="space-y-1">
                            <p>{row.suppression_reason}</p>
                            {row.suppression_recorded_at ? (
                              <p className="text-xs text-muted-foreground">{new Date(row.suppression_recorded_at).toLocaleString()}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Active</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{new Date(row.consent_captured_at).toLocaleString()}</td>
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
