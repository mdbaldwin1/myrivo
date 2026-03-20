"use client";

import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { ConnectComponentsProvider, ConnectTaxRegistrations, ConnectTaxSettings } from "@stripe/react-connect-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SectionCard } from "@/components/ui/section-card";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";

type StripeTaxStatus = "active" | "pending" | "unavailable" | undefined;

type StorePaymentsTaxSetupProps = {
  storeSlug: string | null;
  connected: boolean;
  taxSettingsStatus?: StripeTaxStatus;
  onStatusRefresh: () => Promise<void>;
};

type AccountSessionPayload = {
  publishableKey: string;
  clientSecret: string;
  error?: string;
};

export function StorePaymentsTaxSetup({
  storeSlug,
  connected,
  taxSettingsStatus,
  onStatusRefresh
}: StorePaymentsTaxSetupProps) {
  const [connectInstance, setConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

  async function createAccountSession() {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/account-session", storeSlug), {
      method: "POST"
    });
    const payload = await readJsonSafe<AccountSessionPayload>(response);

    if (!response.ok || !payload?.publishableKey || !payload.clientSecret) {
      throw new Error(payload?.error ?? "Unable to open Stripe Tax setup.");
    }

    return payload;
  }

  async function openTaxSetup() {
    if (!connected) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (connectInstance) {
        setExpanded(true);
        return;
      }

      const initialSession = await createAccountSession();
      let initialClientSecret = initialSession.clientSecret;

      const instance = loadConnectAndInitialize({
        publishableKey: initialSession.publishableKey,
        fetchClientSecret: async () => {
          if (initialClientSecret) {
            const clientSecret = initialClientSecret;
            initialClientSecret = "";
            return clientSecret;
          }

          const refreshedSession = await createAccountSession();
          return refreshedSession.clientSecret;
        }
      });

      setConnectInstance(instance);
      setExpanded(true);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Unable to open Stripe Tax setup.");
    } finally {
      setPending(false);
    }
  }

  const launchButtonLabel = pending
    ? "Opening..."
    : taxSettingsStatus === "active"
      ? "Manage Stripe Tax setup"
      : "Complete Stripe Tax setup";

  return (
    <SectionCard
      title="Stripe Tax setup"
      description="Complete head office and tax registrations for the connected seller account without leaving Myrivo."
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => void openTaxSetup()} disabled={!connected || pending}>
          {launchButtonLabel}
        </Button>
      }
    >
      <div className="space-y-3">
        {!connected ? (
          <p className="text-sm text-muted-foreground">Connect Stripe first, then come back here to complete seller tax setup.</p>
        ) : null}

        {connected && !expanded ? (
          <p className="text-sm text-muted-foreground">
            Use this to set the seller account&apos;s head office and tax registrations that Stripe Tax needs for live checkout.
          </p>
        ) : null}

        {connected && expanded && connectInstance ? (
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium">Tax settings</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set the seller&apos;s head office and product tax defaults for Stripe Tax.
                </p>
                <div className="mt-3">
                  <ConnectTaxSettings
                    onLoadError={({ error: loadError }) => setError(loadError.message ?? "Unable to load Stripe Tax settings.")}
                    onTaxSettingsUpdated={() => {
                      void onStatusRefresh();
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium">Tax registrations</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add the jurisdictions where this seller is registered to collect tax.
                </p>
                <div className="mt-3">
                  <ConnectTaxRegistrations
                    onLoadError={({ error: loadError }) => setError(loadError.message ?? "Unable to load Stripe Tax registrations.")}
                    onAfterTaxRegistrationAdded={() => {
                      void onStatusRefresh();
                    }}
                    onAfterTaxRegistrationExpired={() => {
                      void onStatusRefresh();
                    }}
                  />
                </div>
              </div>
            </div>
          </ConnectComponentsProvider>
        ) : null}

        <FeedbackMessage type="error" message={error} />
      </div>
    </SectionCard>
  );
}
