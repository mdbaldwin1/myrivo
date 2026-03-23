"use client";

import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { ConnectAccountOnboarding, ConnectComponentsProvider, ConnectNotificationBanner } from "@stripe/react-connect-js";
import { AlertTriangle, ExternalLink, Link2, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StorePaymentsTaxDecision } from "@/components/dashboard/store-payments-tax-decision";
import { StorePaymentsTaxSetup } from "@/components/dashboard/store-payments-tax-setup";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Flyout } from "@/components/ui/flyout";
import { SectionCard } from "@/components/ui/section-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { isStorePaymentsReadyForLaunch, isStoreStripeOperationallyReady } from "@/lib/stores/tax-compliance";

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
  taxCollectionMode?: "unconfigured" | "stripe_tax" | "seller_attested_no_tax";
  taxComplianceAcknowledgedAt?: string | null;
  taxComplianceNote?: string | null;
  error?: string;
};

type ConnectionSessionPayload = {
  publishableKey: string;
  clientSecret: string;
  accountId: string;
  error?: string;
};

export function StorePaymentsSettings() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"connect" | "dashboard" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null);
  const [paymentsFlyoutOpen, setPaymentsFlyoutOpen] = useState(false);
  const [paymentsFlyoutTab, setPaymentsFlyoutTab] = useState<"stripe" | "tax">("stripe");
  const { requestConfirm, confirmDialog } = useConfirmDialog();

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

    const createConnectionSession = async () => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/connection-session", storeSlug), { method: "POST" });
      const payload = await readJsonSafe<ConnectionSessionPayload>(response);

      if (!response.ok || !payload?.publishableKey || !payload.clientSecret) {
        throw new Error(payload?.error ?? "Unable to start Stripe setup.");
      }

      return payload;
    };

    try {
      if (connectInstance) {
        setPaymentsFlyoutTab("stripe");
        setPaymentsFlyoutOpen(true);
        await loadStatus();
        return;
      }

      const initialSession = await createConnectionSession();
      let initialClientSecret = initialSession.clientSecret;

      const instance = loadConnectAndInitialize({
        publishableKey: initialSession.publishableKey,
        fetchClientSecret: async () => {
          if (initialClientSecret) {
            const clientSecret = initialClientSecret;
            initialClientSecret = "";
            return clientSecret;
          }

          const refreshedSession = await createConnectionSession();
          return refreshedSession.clientSecret;
        }
      });

      setConnectInstance(instance);
      setPaymentsFlyoutTab("stripe");
      setPaymentsFlyoutOpen(true);
      await loadStatus();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Unable to start Stripe setup.");
    } finally {
      setPending(null);
    }
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

  async function clearStripeSetup() {
    const confirmed = await requestConfirm({
      title: "Disconnect Stripe?",
      description:
        "This will clear the saved Stripe connection, reset the local tax setup state, and the next connect will start with a brand-new Stripe account.",
      confirmLabel: "Disconnect Stripe",
      confirmVariant: "destructive"
    });

    if (!confirmed) {
      return;
    }

    setPending("connect");
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/connect", storeSlug), {
      method: "DELETE"
    });
    const payload = (await readJsonSafe<{ error?: string }>(response)) ?? {};

    if (!response.ok) {
      setError(payload.error ?? "Unable to clear Stripe setup.");
      setPending(null);
      return;
    }

    await loadStatus();
    setConnectInstance(null);
    setPaymentsFlyoutOpen(false);
    notify.success("Stripe disconnected. The next connect will start fresh.");
    setPending(null);
  }

  const connectButtonLabel = pending === "connect"
    ? "Opening..."
    : status?.connected
      ? isStorePaymentsReadyForLaunch(status.taxCollectionMode, {
          connected: Boolean(status.connected),
          chargesEnabled: status.chargesEnabled,
          payoutsEnabled: status.payoutsEnabled,
          detailsSubmitted: status.detailsSubmitted,
          readyForLiveCheckout: Boolean(status.readyForLiveCheckout)
        })
        ? "Manage Stripe account"
        : "Continue Stripe setup"
      : "Connect Stripe";

  const operationallyReady = status
    ? isStoreStripeOperationallyReady({
        connected: Boolean(status.connected),
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        readyForLiveCheckout: Boolean(status.readyForLiveCheckout)
      })
    : false;

  const paymentsReadyForConfiguredPath = status
    ? isStorePaymentsReadyForLaunch(status.taxCollectionMode, {
        connected: Boolean(status.connected),
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        readyForLiveCheckout: Boolean(status.readyForLiveCheckout)
      })
    : false;

  const connectionSummaryLabel = !status?.connected
    ? "Not connected"
    : paymentsReadyForConfiguredPath
      ? "Ready for live checkout"
      : "Setup still needs attention";

  const usingNoTaxPath = Boolean(status?.taxCollectionMode === "seller_attested_no_tax" && operationallyReady);

  const connectionStatusPillClassName = !status?.connected
    ? "border-border/70 bg-muted/40 text-muted-foreground"
    : paymentsReadyForConfiguredPath
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const showConnectionWarning = Boolean(status?.connected && (!paymentsReadyForConfiguredPath || usingNoTaxPath));
  const showStripeRequirementsSection = Boolean(
    status?.connected &&
    !operationallyReady
  );

  const savedTaxModeLabel = status?.taxCollectionMode === "stripe_tax"
    ? "Stripe Tax"
    : status?.taxCollectionMode === "seller_attested_no_tax"
      ? "Seller-attested no tax"
      : "Not chosen";

  return (
    <div className="space-y-3">
      <SectionCard title="Store Payments (Stripe Connect)">
        <div className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading payment status...</p> : null}

          {!loading && !status?.connected ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
              <p className="text-sm font-medium">No Stripe account connected yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start the Stripe Connect setup here when this store is ready to accept payments.
              </p>
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => void connectStripe()} disabled={pending !== null}>
                  {connectButtonLabel}
                </Button>
              </div>
            </div>
          ) : null}

          {!loading && status?.connected ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${
                    paymentsReadyForConfiguredPath
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {paymentsReadyForConfiguredPath ? (
                      <Link2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Stripe account</p>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${connectionStatusPillClassName}`}>
                        {connectionSummaryLabel}
                      </span>
                    </div>
                    {status.accountId ? <p className="text-xs text-muted-foreground">Account: {status.accountId}</p> : null}
                  </div>
                </div>
                {status.connected ? (
                  <TooltipProvider delayDuration={120}>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void loadStatus()} disabled={loading || pending !== null}>
                            <RefreshCw className="h-4 w-4" />
                            <span className="sr-only">Refresh connection status</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Refresh</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void openDashboard()} disabled={pending !== null}>
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Open Stripe Dashboard</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Open Dashboard</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void connectStripe()} disabled={pending !== null}>
                            <Settings2 className="h-4 w-4" />
                            <span className="sr-only">Manage Stripe connection</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Manage Connection</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => void clearStripeSetup()} disabled={pending !== null}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Clear Stripe setup</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete / Clear</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                ) : null}
              </div>

              {showConnectionWarning ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
                  {usingNoTaxPath ? (
                    <>
                      <p className="font-medium">Seller-attested no-tax path is active.</p>
                      <p className="mt-1 text-amber-900/80">
                        This store is operationally ready for checkout, but it is using the riskier no-tax path instead of Stripe Tax. The seller remains responsible for determining and complying with tax obligations.
                      </p>
                    </>
                  ) : status.taxSettingsStatus === "pending" && status.taxMissingFields?.length ? (
                    <>
                      <p className="font-medium">Stripe Tax setup still needs attention.</p>
                      <p className="mt-1 text-amber-900/80">Complete these fields before live checkout can start:</p>
                      <ul className="mt-2 space-y-1">
                        {status.taxMissingFields.map((field) => (
                          <li key={field}>• {field}</li>
                        ))}
                      </ul>
                    </>
                  ) : status.taxSettingsStatus === "unavailable" ? (
                    <>
                      <p className="font-medium">Stripe Tax readiness could not be confirmed.</p>
                      <p className="mt-1 text-amber-900/80">Open Stripe and verify the seller account setup before going live.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Stripe setup is incomplete.</p>
                      <p className="mt-1 text-amber-900/80">
                        Review the Stripe setup flow and finish any missing onboarding requirements before live checkout can start.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Stripe account and tax setup are in good shape for live checkout.
                </p>
              )}
            </div>
          ) : null}

          <FeedbackMessage type="error" message={error} />
        </div>
      </SectionCard>

      <Flyout
        open={paymentsFlyoutOpen}
        onOpenChange={(open) => setPaymentsFlyoutOpen(open)}
        title="Stripe setup"
        description="Use this guided flow to connect Stripe, clear any Stripe requirements, and decide how this store will handle tax."
        footer={({ requestClose }) => (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={requestClose}>
              Close
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Connection</p>
                <p className="mt-1 text-sm font-medium">{connectionSummaryLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status?.accountId ? `Account ${status.accountId}` : "No Stripe account connected yet."}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tax path</p>
                <p className="mt-1 text-sm font-medium">{savedTaxModeLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status?.taxCollectionMode === "stripe_tax"
                    ? "This store is using Stripe Tax for tax collection."
                    : status?.taxCollectionMode === "seller_attested_no_tax"
                      ? "This store is using the seller-attested no-tax path."
                      : "A tax path still needs to be chosen before launch."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                paymentsFlyoutTab === "stripe"
                  ? "border-border bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-background/70 hover:text-foreground"
              }`}
              onClick={() => setPaymentsFlyoutTab("stripe")}
            >
              Stripe setup
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                paymentsFlyoutTab === "tax"
                  ? "border-border bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-background/70 hover:text-foreground"
              }`}
              onClick={() => setPaymentsFlyoutTab("tax")}
            >
              Tax setup
            </button>
          </div>

          {paymentsFlyoutTab === "stripe" ? (
            status?.connected && connectInstance ? (
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <div className="space-y-6">
                  {showStripeRequirementsSection ? (
                    <section className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Stripe requirements</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Clear any outstanding onboarding or compliance tasks that Stripe still requires for this seller account.
                        </p>
                      </div>
                      <ConnectNotificationBanner
                        collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
                        onLoadError={({ error: loadError }) => setError(loadError.message ?? "Unable to load Stripe requirements.")}
                      />
                    </section>
                  ) : null}

                  <section className={`space-y-3 ${showStripeRequirementsSection ? "border-t border-border/60 pt-5" : ""}`}>
                    <div>
                      <p className="text-sm font-medium">Manage Stripe connection</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Finish onboarding details and respond to Stripe account requirements without leaving Myrivo.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <ConnectAccountOnboarding
                        onExit={() => {
                          void loadStatus();
                        }}
                        onLoadError={({ error: loadError }) => setError(loadError.message ?? "Unable to load Stripe account setup.")}
                      />
                    </div>
                  </section>
                </div>
              </ConnectComponentsProvider>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5">
                <p className="text-sm font-medium">Connect Stripe to begin</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start with the Stripe connection, then come back to the tax tab to finish how this store will handle tax.
                </p>
                <div className="mt-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => void connectStripe()} disabled={pending !== null}>
                    {connectButtonLabel}
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Tax handling decision</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose the tax path first. Stripe Tax setup stays hidden until that choice has been saved.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <StorePaymentsTaxDecision
                    key={`${storeSlug ?? "store"}:${status?.taxCollectionMode ?? "unconfigured"}:${status?.taxComplianceAcknowledgedAt ?? ""}:${status?.taxComplianceNote ?? ""}`}
                    storeSlug={storeSlug}
                    connected={Boolean(status?.connected)}
                    taxCollectionMode={status?.taxCollectionMode ?? "unconfigured"}
                    taxComplianceAcknowledgedAt={status?.taxComplianceAcknowledgedAt ?? null}
                    taxComplianceNote={status?.taxComplianceNote ?? null}
                    onStatusRefresh={loadStatus}
                  />
                </div>
              </section>

              {status?.taxCollectionMode === "stripe_tax" ? (
                <section className="space-y-3 border-t border-border/60 pt-5">
                  <div>
                    <p className="text-sm font-medium">Stripe Tax setup</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Complete the seller&apos;s tax settings and registrations as the next step in payments readiness.
                    </p>
                  </div>
                  <StorePaymentsTaxSetup
                    storeSlug={storeSlug}
                    connected={Boolean(status?.connected)}
                    taxSettingsStatus={status?.taxSettingsStatus}
                    onStatusRefresh={loadStatus}
                  />
                </section>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5">
                  <p className="text-sm font-medium">Stripe Tax setup will unlock after you save that choice</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Save `Set up tax collection with Stripe Tax` above when you want this store to continue into Stripe Tax settings and registrations.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Flyout>
      {confirmDialog}

    </div>
  );
}
