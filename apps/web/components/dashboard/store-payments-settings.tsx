"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";

type PaymentsStatus = {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  readyForLiveCheckout?: boolean;
  error?: string;
};

export function StorePaymentsSettings() {
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

    const response = await fetch("/api/stores/payments/status", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadStatus]);

  async function connectStripe() {
    setPending("connect");
    setError(null);

    const response = await fetch("/api/stores/payments/connect", { method: "POST" });
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

    const response = await fetch("/api/stores/payments/dashboard-link", { method: "POST" });
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
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                Connection: <span className="font-medium">{status.connected ? "Connected" : "Not connected"}</span>
              </p>
              {status.accountId ? <p className="text-xs text-muted-foreground">Account: {status.accountId}</p> : null}
              {status.connected ? (
                <>
                  <p className="text-xs text-muted-foreground">Charges enabled: {status.chargesEnabled ? "Yes" : "No"}</p>
                  <p className="text-xs text-muted-foreground">Payouts enabled: {status.payoutsEnabled ? "Yes" : "No"}</p>
                  <p className="text-xs text-muted-foreground">Details submitted: {status.detailsSubmitted ? "Yes" : "No"}</p>
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
