"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";

type PlatformConfigResponse = {
  store?: {
    mode: "sandbox" | "live";
    white_label_enabled: boolean;
    white_label_brand_name: string | null;
    white_label_favicon_path: string | null;
  };
  billing?: {
    fee_override_bps: number | null;
    fee_override_fixed_cents: number | null;
    test_mode_enabled: boolean;
    billing_plans?: { key: string; name: string; transaction_fee_bps: number; transaction_fee_fixed_cents: number } | null;
  };
  plans?: Array<{ key: string; name: string; monthly_price_cents: number; transaction_fee_bps: number; transaction_fee_fixed_cents: number }>;
  error?: string;
};

export function PlatformControlsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"sandbox" | "live">("live");
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [whiteLabelBrandName, setWhiteLabelBrandName] = useState("");
  const [whiteLabelFaviconPath, setWhiteLabelFaviconPath] = useState("");
  const [billingPlanKey, setBillingPlanKey] = useState("starter");
  const [feeOverrideBps, setFeeOverrideBps] = useState("");
  const [feeOverrideFixedCents, setFeeOverrideFixedCents] = useState("");
  const [plans, setPlans] = useState<PlatformConfigResponse["plans"]>([]);

  const billingHelper = useMemo(() => {
    const selected = plans?.find((plan) => plan.key === billingPlanKey);
    if (!selected) {
      return "";
    }

    return `${selected.name}: $${(selected.monthly_price_cents / 100).toFixed(2)}/mo, ${selected.transaction_fee_bps / 100}% + $${(
      selected.transaction_fee_fixed_cents / 100
    ).toFixed(2)} fee`;
  }, [billingPlanKey, plans]);

  async function fetchConfig() {
    const response = await fetch("/api/stores/platform-config", { cache: "no-store" });
    const payload = (await response.json()) as PlatformConfigResponse;
    return { ok: response.ok, payload };
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchConfig();
      if (cancelled) {
        return;
      }
      if (!result.ok || !result.payload.store) {
        setError(result.payload.error ?? "Unable to load platform settings.");
        setLoading(false);
        return;
      }
      setMode(result.payload.store.mode);
      setTestModeEnabled(result.payload.billing?.test_mode_enabled ?? false);
      setWhiteLabelEnabled(result.payload.store.white_label_enabled);
      setWhiteLabelBrandName(result.payload.store.white_label_brand_name ?? "");
      setWhiteLabelFaviconPath(result.payload.store.white_label_favicon_path ?? "");
      setBillingPlanKey(result.payload.billing?.billing_plans?.key ?? result.payload.plans?.[0]?.key ?? "starter");
      setFeeOverrideBps(result.payload.billing?.fee_override_bps?.toString() ?? "");
      setFeeOverrideFixedCents(result.payload.billing?.fee_override_fixed_cents?.toString() ?? "");
      setPlans(result.payload.plans ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveConfig() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/platform-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        testModeEnabled,
        whiteLabelEnabled,
        whiteLabelBrandName: whiteLabelBrandName.trim() || null,
        whiteLabelFaviconPath: whiteLabelFaviconPath.trim() || null,
        billingPlanKey,
        feeOverrideBps: feeOverrideBps.trim() ? Number.parseInt(feeOverrideBps, 10) : null,
        feeOverrideFixedCents: feeOverrideFixedCents.trim() ? Number.parseInt(feeOverrideFixedCents, 10) : null
      })
    });

    const payload = (await response.json()) as PlatformConfigResponse;

    if (!response.ok) {
      setError(payload.error ?? "Unable to save platform settings.");
      setSaving(false);
      return;
    }

    setLoading(true);
    const refreshed = await fetchConfig();
    if (!refreshed.ok || !refreshed.payload.store) {
      setError(refreshed.payload.error ?? "Unable to reload platform settings.");
      setLoading(false);
      setSaving(false);
      return;
    }
    setMode(refreshed.payload.store.mode);
    setTestModeEnabled(refreshed.payload.billing?.test_mode_enabled ?? false);
    setWhiteLabelEnabled(refreshed.payload.store.white_label_enabled);
    setWhiteLabelBrandName(refreshed.payload.store.white_label_brand_name ?? "");
    setWhiteLabelFaviconPath(refreshed.payload.store.white_label_favicon_path ?? "");
    setBillingPlanKey(refreshed.payload.billing?.billing_plans?.key ?? refreshed.payload.plans?.[0]?.key ?? "starter");
    setFeeOverrideBps(refreshed.payload.billing?.fee_override_bps?.toString() ?? "");
    setFeeOverrideFixedCents(refreshed.payload.billing?.fee_override_fixed_cents?.toString() ?? "");
    setPlans(refreshed.payload.plans ?? []);
    setLoading(false);
    setSaving(false);
  }

  return (
    <SectionCard
      title="Platform Controls"
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => void saveConfig()} disabled={saving || loading}>
          {saving ? "Saving..." : "Save"}
        </Button>
      }
    >
      {loading ? <p className="text-sm text-muted-foreground">Loading platform settings...</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Store Mode" description="Sandbox blocks live operations until you switch to live.">
          <Select value={mode} onChange={(event) => setMode(event.target.value as "sandbox" | "live")}>
            <option value="live">Live</option>
            <option value="sandbox">Sandbox</option>
          </Select>
        </FormField>

        <FormField label="Test Mode" description="Use test credentials and isolated billing behaviors.">
          <Select value={testModeEnabled ? "true" : "false"} onChange={(event) => setTestModeEnabled(event.target.value === "true")}>
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </Select>
        </FormField>

        <FormField label="Billing Plan" description={billingHelper || "Select a plan for transaction fees."}>
          <Select value={billingPlanKey} onChange={(event) => setBillingPlanKey(event.target.value)}>
            {(plans ?? []).map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Fee Override (BPS)" description="Optional percentage override, e.g. 250 = 2.5%.">
          <Input type="number" min={0} max={10000} value={feeOverrideBps} onChange={(event) => setFeeOverrideBps(event.target.value)} />
        </FormField>

        <FormField label="Fee Override Fixed (cents)" description="Optional fixed cents override per order.">
          <Input type="number" min={0} value={feeOverrideFixedCents} onChange={(event) => setFeeOverrideFixedCents(event.target.value)} />
        </FormField>

        <FormField label="White Label Enabled" description="Enable custom domain and branding assets.">
          <Select value={whiteLabelEnabled ? "true" : "false"} onChange={(event) => setWhiteLabelEnabled(event.target.value === "true")}>
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </Select>
        </FormField>

        <FormField label="White Label Brand Name" description="Brand name shown in app metadata and templates.">
          <Input value={whiteLabelBrandName} onChange={(event) => setWhiteLabelBrandName(event.target.value)} placeholder="At Home Apothecary" />
        </FormField>

        <FormField label="White Label Favicon Path" description="Public asset path for favicon override.">
          <Input value={whiteLabelFaviconPath} onChange={(event) => setWhiteLabelFaviconPath(event.target.value)} placeholder="/brand/at-home-favicon.ico" />
        </FormField>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </SectionCard>
  );
}
