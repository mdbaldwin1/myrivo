"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type PaymentsStatus = {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  taxSettingsStatus?: "active" | "pending" | "unavailable";
  taxMissingFields?: string[];
  taxReady?: boolean;
  readyForLiveCheckout?: boolean;
  error?: string;
};

export function StorePaymentsSettings() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"connect" | "dashboard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readJsonSafe<T>(response: Response): Promise<T | null> {
    try {
      const text = await response.text();
      if (!text) {
        return null;
      }
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/status", storeSlug), { cache: "no-store" });
    const payload = await readJsonSafe<PaymentsStatus & { error?: string }>(response);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to load payment status.");
      setLoading(false);
      return;
    }

    if (!payload) {
      setError("Unable to parse payment status response.");
      setLoading(false);
      return;
    }

    setStatus(payload);
    setLoading(false);
  }, [storeSlug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadStatus]);

  async function connectStripe() {
    setPending("connect");
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/connect", storeSlug), { method: "POST" });
    const payload = (await readJsonSafe<{ onboardingUrl?: string; error?: string }>(response)) ?? {};

    if (!response.ok || !payload.onboardingUrl) {
      setError(payload.error ?? "Unable to start Stripe onboarding.");
      setPending(null);
      return;
    }

    window.location.assign(payload.onboardingUrl);
  }

  async function openDashboard() {
    setPending("dashboard");
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/dashboard-link", storeSlug), { method: "POST" });
    const payload = (await readJsonSafe<{ dashboardUrl?: string; error?: string }>(response)) ?? {};

    if (!response.ok || !payload.dashboardUrl) {
      setError(payload.error ?? "Unable to open Stripe dashboard.");
      setPending(null);
      return;
    }

    window.open(payload.dashboardUrl, "_blank", "noopener,noreferrer");
    setPending(null);
  }

  const connectButtonLabel = pending === "connect"
    ? "Opening..."
    : status?.connected
      ? status.readyForLiveCheckout
        ? "Manage Stripe account"
        : "Continue Stripe setup"
      : "Connect Stripe";

  const taxStatusLabel = status?.taxSettingsStatus === "active"
    ? "Active"
    : status?.taxSettingsStatus === "pending"
      ? "Pending setup"
      : status?.taxSettingsStatus === "unavailable"
        ? "Unavailable"
        : "Not connected";

  return (
    <SectionCard
      title="Store Payments (Stripe Connect)"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void connectStripe()} disabled={pending !== null}>
            {connectButtonLabel}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadStatus()} disabled={loading || pending !== null}>
            Refresh status
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading payment status...</p> : null}

        {!loading && status ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium">Connection Status</p>
            <p className="mt-1 text-xs text-muted-foreground">Review Stripe onboarding state and readiness to accept payments.</p>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                Connection: <span className="font-medium">{status.connected ? "Connected" : "Not connected"}</span>
              </p>
              {status.accountId ? <p className="text-xs text-muted-foreground">Account: {status.accountId}</p> : null}
              {status.connected ? (
                <>
                  <p className="text-xs text-muted-foreground">Charges enabled: {status.chargesEnabled ? "Yes" : "No"}</p>
                  <p className="text-xs text-muted-foreground">Payouts enabled: {status.payoutsEnabled ? "Yes" : "No"}</p>
                  <p className="text-xs text-muted-foreground">Details submitted: {status.detailsSubmitted ? "Yes" : "No"}</p>
                  <p className="text-xs text-muted-foreground">Stripe Tax status: {taxStatusLabel}</p>
                  {status.taxSettingsStatus === "pending" && status.taxMissingFields?.length ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
                      <p className="font-medium">Stripe Tax setup still needs attention.</p>
                      <p className="mt-1 text-amber-900/80">Complete these fields in Stripe before live checkout can start:</p>
                      <ul className="mt-2 space-y-1">
                        {status.taxMissingFields.map((field) => (
                          <li key={field}>• {field}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {status.taxSettingsStatus === "unavailable" ? (
                    <p className="text-xs text-amber-700">
                      We could not confirm Stripe Tax readiness right now. Open Stripe and verify tax settings before going live.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Live checkout ready: {status.readyForLiveCheckout ? "Yes" : "No"}</p>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {status?.connected ? (
            <Button type="button" variant="outline" onClick={() => void openDashboard()} disabled={pending !== null}>
              {pending === "dashboard" ? "Opening..." : "Open Stripe Dashboard"}
            </Button>
          ) : null}
        </div>

        <FeedbackMessage type="error" message={error} />
      </div>
    </SectionCard>
  );
}
