"use client";

import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type ShippingSettingsResponse = {
  shippingProvider: "none" | "easypost";
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  webhookSecret: string | null;
  webhookUrl: string;
  source?: "store" | "env";
  error?: string;
};

export function StoreShippingSettings() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<"none" | "easypost">("none");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [source, setSource] = useState<"store" | "env" | "default" | null>(null);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [flyoutBaseline, setFlyoutBaseline] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [flyoutError, setFlyoutError] = useState<string | null>(null);

  function buildFlyoutSnapshot() {
    return JSON.stringify({
      provider,
      apiKey,
      webhookSecret
    });
  }

  const isDirty = isFlyoutOpen && buildFlyoutSnapshot() !== flyoutBaseline;

  function openFlyout() {
    setFlyoutBaseline(buildFlyoutSnapshot());
    setFlyoutError(null);
    setIsFlyoutOpen(true);
  }

  function resetDraftFromBaseline() {
    if (!flyoutBaseline) {
      setFlyoutError(null);
      return;
    }

    try {
      const parsed = JSON.parse(flyoutBaseline) as { provider: "none" | "easypost"; apiKey: string; webhookSecret: string };
      setProvider(parsed.provider);
      setApiKey(parsed.apiKey);
      setWebhookSecret(parsed.webhookSecret);
    } catch {
      // no-op: if baseline parsing fails, keep current inputs and just clear the error.
    }

    setFlyoutError(null);
  }

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/shipping", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as ShippingSettingsResponse;

    if (!response.ok) {
      setPageError(payload.error ?? "Unable to load shipping settings.");
      setLoading(false);
      return;
    }

    setProvider(payload.shippingProvider);
    setWebhookSecret(payload.webhookSecret ?? "");
    setWebhookUrl(payload.webhookUrl);
    setHasApiKey(payload.hasApiKey);
    setHasWebhookSecret(payload.hasWebhookSecret);
    setSource(payload.source ?? null);
    setLoading(false);
  }, [storeSlug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadSettings]);

  async function saveSettings(regenerateWebhookSecret = false) {
    setSaving(true);
    setFlyoutError(null);
    setPageError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/shipping", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingProvider: provider,
        shippingApiKey: apiKey.trim() || null,
        shippingWebhookSecret: webhookSecret.trim() || null,
        regenerateWebhookSecret
      })
    });

    const payload = (await response.json()) as ShippingSettingsResponse;
    setSaving(false);

    if (!response.ok) {
      setFlyoutError(payload.error ?? "Unable to save shipping settings.");
      return;
    }

    setWebhookSecret(payload.webhookSecret ?? "");
    setWebhookUrl(payload.webhookUrl);
    setHasApiKey(payload.hasApiKey);
    setHasWebhookSecret(payload.hasWebhookSecret);
    setSource(payload.source ?? null);
    setApiKey("");
    notify.success(regenerateWebhookSecret ? "Webhook secret regenerated." : "Shipping settings saved.");
    if (!regenerateWebhookSecret) {
      setIsFlyoutOpen(false);
    }
  }

  async function clearSettings() {
    const confirmed = window.confirm("Clear this store's shipping integration setup? This will remove the saved provider credentials and webhook secret.");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setFlyoutError(null);
    setPageError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/shipping", storeSlug), {
      method: "DELETE"
    });

    const payload = (await response.json()) as ShippingSettingsResponse;
    setSaving(false);

    if (!response.ok) {
      setPageError(payload.error ?? "Unable to clear shipping settings.");
      return;
    }

    setProvider("none");
    setApiKey("");
    setWebhookSecret("");
    setWebhookUrl(payload.webhookUrl);
    setHasApiKey(false);
    setHasWebhookSecret(false);
    setSource(payload.source ?? "default");
    setIsFlyoutOpen(false);
    notify.success("Shipping setup cleared.");
  }

  const hasConfiguredSetup = source === "store" || provider !== "none" || hasApiKey || hasWebhookSecret;

  return (
    <SectionCard title="Shipping Provider">
      <div className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading shipping settings...</p> : null}

        {!loading && !hasConfiguredSetup ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-medium">No shipping integration configured yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set up a provider when this store is ready for synced shipping updates.
            </p>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={openFlyout} disabled={saving}>
                Configure shipping
              </Button>
            </div>
          </div>
        ) : null}

        {!loading && hasConfiguredSetup ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Current Configuration</p>
                <p className="mt-1 text-xs text-muted-foreground">These values reflect the currently active store shipping integration state.</p>
              </div>
              <TooltipProvider delayDuration={120}>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void loadSettings()} disabled={loading || saving}>
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">Refresh shipping settings</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Refresh</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={openFlyout} disabled={saving}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Manage shipping setup</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Manage Setup</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => void clearSettings()} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Clear shipping setup</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete / Clear</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Provider: {provider === "easypost" ? "EasyPost" : "None"}</p>
              <p>Source: {source ?? "unknown"}</p>
              <p>API key configured: {hasApiKey ? "Yes" : "No"}</p>
              <p>Webhook secret configured: {hasWebhookSecret ? "Yes" : "No"}</p>
            </div>
          </div>
        ) : null}

        <AppAlert variant="error" message={pageError} />

        <Flyout
          open={isFlyoutOpen}
          onOpenChange={(open) => {
            setIsFlyoutOpen(open);
            if (!open) {
              setFlyoutError(null);
            }
          }}
          confirmDiscardOnClose
          isDirty={isDirty}
          onDiscardConfirm={resetDraftFromBaseline}
          title="Configure Shipping Provider"
          description="Set carrier sync provider and webhook credentials."
          footer={({ requestClose }) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AppAlert compact variant="error" message={flyoutError} className="text-sm" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetDraftFromBaseline();
                    requestClose();
                  }}
                  disabled={saving}
                >
                  Discard
                </Button>
                <Button type="button" variant="outline" onClick={() => void saveSettings(true)} disabled={saving}>
                  {saving ? "Saving..." : "Regenerate webhook secret"}
                </Button>
                <Button type="button" onClick={() => void saveSettings(false)} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        >
          <div className="space-y-4">
            <FormField label="Provider" description="Choose manual tracking only, or connect EasyPost for synced updates.">
              <Select value={provider} onChange={(event) => setProvider(event.target.value as "none" | "easypost")}>
                <option value="none">None (manual tracking link only)</option>
                <option value="easypost">EasyPost</option>
              </Select>
            </FormField>

            {provider === "easypost" ? (
              <FormField label="EasyPost API Key" description="Leave blank to keep your existing API key.">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={hasApiKey ? "Saved (enter new key to replace)" : "EZAK..."}
                />
              </FormField>
            ) : null}

            <FormField label="Webhook Secret" description="Used to verify incoming shipping webhook payloads.">
              <Input value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="ship_..." />
            </FormField>

            <FormField label="Webhook URL" description="Configure this URL in your shipping provider dashboard.">
              <Input value={webhookUrl} readOnly placeholder="https://your-domain.com/api/shipping/webhook" />
            </FormField>
          </div>
        </Flyout>
      </div>
    </SectionCard>
  );
}
