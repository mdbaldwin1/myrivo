"use client";

import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { ConnectComponentsProvider, ConnectTaxRegistrations, ConnectTaxSettings } from "@stripe/react-connect-js";
import { RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const statusLabel = taxSettingsStatus === "active"
    ? "Tax setup looks healthy"
    : taxSettingsStatus === "pending"
      ? "Tax setup still needs work"
      : "Tax readiness is still unknown";

  return (
    <div className="space-y-3">
      {!connected ? (
        <p className="text-sm text-muted-foreground">Connect Stripe first, then come back here to complete seller tax setup.</p>
      ) : null}

      {connected && !expanded ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
          <p className="text-sm font-medium">Stripe Tax setup is ready when you are</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this to set the seller account&apos;s head office and tax registrations that Stripe Tax needs for live checkout.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{statusLabel}</span>
          </p>
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void openTaxSetup()} disabled={pending}>
              {launchButtonLabel}
            </Button>
          </div>
        </div>
      ) : null}

      {connected && expanded && connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Stripe Tax setup</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Complete the seller&apos;s tax settings and registrations here without leaving Myrivo.
                </p>
              </div>
              <TooltipProvider delayDuration={120}>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void onStatusRefresh()} disabled={pending}>
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">Refresh Stripe Tax status</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Refresh</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void openTaxSetup()} disabled={pending}>
                        <Settings2 className="h-4 w-4" />
                        <span className="sr-only">Manage Stripe Tax setup</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Manage Setup</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            <div className="mt-4 space-y-5">
              <div>
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

              <div className="border-t border-border/60 pt-5">
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
          </div>
        </ConnectComponentsProvider>
      ) : null}

      <FeedbackMessage type="error" message={error} />
    </div>
  );
}
