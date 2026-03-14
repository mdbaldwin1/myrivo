"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import {
  getStorePrivacyOptOutStateLabel,
  getStorePrivacyRequestStatusLabel,
  getStorePrivacyRequestTypeLabel
} from "@/lib/privacy/store-privacy";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type PrivacyRequestRow = {
  id: string;
  email: string;
  full_name: string | null;
  request_type: "access" | "deletion" | "correction" | "know" | "opt_out_sale_share";
  status: "open" | "in_progress" | "completed" | "closed";
  source: "privacy_page" | "support" | "manual";
  metadata_json: Record<string, unknown>;
  details: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type RequestsResponse = {
  requests?: PrivacyRequestRow[];
  error?: string;
};

type PrivacyOptOutRow = {
  id: string;
  email: string;
  full_name: string | null;
  state: "active" | "revoked";
  source: "privacy_page" | "browser_signal" | "support" | "manual";
  latest_request_id: string | null;
  created_at: string;
  updated_at: string;
};

type OptOutsResponse = {
  optOuts?: PrivacyOptOutRow[];
  error?: string;
};

export function StorePrivacyRequestsPanel() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [requests, setRequests] = useState<PrivacyRequestRow[]>([]);
  const [optOuts, setOptOuts] = useState<PrivacyOptOutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingOptOutId, setPendingOptOutId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const [requestsResponse, optOutsResponse] = await Promise.all([
      fetch(buildStoreScopedApiPath("/api/stores/privacy-requests", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/privacy-opt-outs", storeSlug), { cache: "no-store" })
    ]);
    const requestsPayload = (await requestsResponse.json()) as RequestsResponse;
    const optOutsPayload = (await optOutsResponse.json()) as OptOutsResponse;
    if (!requestsResponse.ok || !requestsPayload.requests) {
      throw new Error(requestsPayload.error ?? "Unable to load privacy requests.");
    }
    if (!optOutsResponse.ok || !optOutsPayload.optOuts) {
      throw new Error(optOutsPayload.error ?? "Unable to load privacy opt-out states.");
    }
    return { requests: requestsPayload.requests, optOuts: optOutsPayload.optOuts };
  }, [storeSlug]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await loadRequests();
        if (!cancelled) {
          setRequests(next.requests);
          setOptOuts(next.optOuts);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load privacy requests.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadRequests]);

  async function updateStatus(requestId: string, status: PrivacyRequestRow["status"]) {
    setPendingRequestId(requestId);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/privacy-requests", storeSlug), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status })
      });
      const payload = (await response.json()) as RequestsResponse;
      if (!response.ok || !payload.requests) {
        throw new Error(payload.error ?? "Unable to update privacy request.");
      }
      setRequests(payload.requests);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update privacy request.");
    } finally {
      setPendingRequestId(null);
    }
  }

  async function updateOptOutState(optOutId: string, state: PrivacyOptOutRow["state"]) {
    setPendingOptOutId(optOutId);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/privacy-opt-outs", storeSlug), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOutId, state })
      });
      const payload = (await response.json()) as OptOutsResponse;
      if (!response.ok || !payload.optOuts) {
        throw new Error(payload.error ?? "Unable to update privacy opt-out state.");
      }
      setOptOuts(payload.optOuts);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update privacy opt-out state.");
    } finally {
      setPendingOptOutId(null);
    }
  }

  return (
    <SectionCard
      title="Privacy requests"
      description="Recent privacy-related requests submitted by shoppers. Use this as the operator handoff until deeper rights-fulfillment tooling exists."
    >
      <div className="space-y-4">
        <AppAlert variant="error" compact message={error} />
        {loading ? <p className="text-sm text-muted-foreground">Loading privacy requests...</p> : null}
        {!loading && requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No privacy requests have been submitted yet.</p>
        ) : null}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Support workflow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the request row to confirm the shopper’s ask, then compare it with any active do-not-sell/share state below. Browser signal entries mean the shopper’s device sent a privacy signal in addition to the request form.
          </p>
        </div>
        {optOuts.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Do Not Sell / Share states</p>
              <p className="text-sm text-muted-foreground">
                These records represent the current explicit opt-out state for shoppers who submitted a do-not-sell/share request.
              </p>
            </div>
            <div className="space-y-3">
              {optOuts.map((optOut) => (
                <div key={optOut.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-background p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {optOut.full_name ? `${optOut.full_name} · ` : ""}
                      {optOut.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Source: {optOut.source === "browser_signal" ? "Browser signal" : optOut.source.replaceAll("_", " ")}
                      {" · "}
                      Updated {new Date(optOut.updated_at).toLocaleString("en-US")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={optOut.state}
                      onChange={(event) => void updateOptOutState(optOut.id, event.target.value as PrivacyOptOutRow["state"])}
                      disabled={pendingOptOutId === optOut.id}
                    >
                      {(["active", "revoked"] as const).map((state) => (
                        <option key={state} value={state}>
                          {getStorePrivacyOptOutStateLabel(state)}
                        </option>
                      ))}
                    </Select>
                    {pendingOptOutId === optOut.id ? (
                      <Button type="button" variant="outline" disabled>
                        Saving...
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {requests.map((request) => (
          <div key={request.id} className="space-y-3 rounded-xl border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {getStorePrivacyRequestTypeLabel(request.request_type)}
                  {request.full_name ? ` · ${request.full_name}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">{request.email}</p>
                <p className="text-xs text-muted-foreground">
                  Source: {request.source.replaceAll("_", " ")}
                  {request.metadata_json.global_privacy_control === true ? " · Browser signal detected" : ""}
                  {" · "}
                  Submitted {new Date(request.created_at).toLocaleString("en-US")}
                  {request.resolved_at ? ` · Resolved ${new Date(request.resolved_at).toLocaleString("en-US")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={request.status}
                  onChange={(event) => void updateStatus(request.id, event.target.value as PrivacyRequestRow["status"])}
                  disabled={pendingRequestId === request.id}
                >
                  {(["open", "in_progress", "completed", "closed"] as const).map((status) => (
                    <option key={status} value={status}>
                      {getStorePrivacyRequestStatusLabel(status)}
                    </option>
                  ))}
                </Select>
                {pendingRequestId === request.id ? (
                  <Button type="button" variant="outline" disabled>
                    Saving...
                  </Button>
                ) : null}
              </div>
            </div>
            {request.details ? <p className="text-sm leading-relaxed text-muted-foreground">{request.details}</p> : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
