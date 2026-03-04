"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";

type PaymentsStatus = {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  hasStripeEnv?: boolean;
  mode?: "stub" | "live";
  readyForLiveCheckout?: boolean;
  error?: string;
};

export function StorePaymentsSettings() {
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"connect" | "dashboard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/stores/payments/status", { cache: "no-store" });
    const payload = (await response.json()) as PaymentsStatus & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to load payment status.");
      setLoading(false);
      return;
    }

    setStatus(payload);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  async function connectStripe() {
    setPending("connect");
    setError(null);

    const response = await fetch("/api/stores/payments/connect", { method: "POST" });
    const payload = (await response.json()) as { onboardingUrl?: string; error?: string };

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
    const payload = (await response.json()) as { dashboardUrl?: string; error?: string };

    if (!response.ok || !payload.dashboardUrl) {
      setError(payload.error ?? "Unable to open Stripe dashboard.");
      setPending(null);
      return;
    }

    window.location.assign(payload.dashboardUrl);
  }

  return (
    <SectionCard
      title="Store Payments (Stripe Connect)"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void connectStripe()} disabled={pending !== null}>
            {pending === "connect" ? "Opening..." : status?.connected ? "Continue Stripe setup" : "Connect Stripe"}
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
          <div className="rounded-md border border-border bg-white p-3 text-sm">
            <p>
              Checkout mode: <span className="font-medium uppercase">{status.mode ?? "unknown"}</span>
            </p>
            <p>
              Stripe env configured: <span className="font-medium">{status.hasStripeEnv ? "Yes" : "No"}</span>
            </p>
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
