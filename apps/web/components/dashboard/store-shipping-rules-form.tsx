"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type ShippingSettingsSnapshot = {
  checkout_enable_flat_rate_shipping: boolean;
  checkout_flat_rate_shipping_label: string | null;
  checkout_flat_rate_shipping_fee_cents: number;
};

type SettingsResponse = {
  settings?: Partial<ShippingSettingsSnapshot>;
  error?: string;
};

type StoreShippingRulesFormProps = {
  header?: ReactNode;
};

export function StoreShippingRulesForm({ header }: StoreShippingRulesFormProps) {
  const formId = "shipping-rules-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [label, setLabel] = useState("Shipping");
  const [feeCents, setFeeCents] = useState(0);
  const [baseline, setBaseline] = useState<ShippingSettingsSnapshot | null>(null);

  const snapshot = useMemo<ShippingSettingsSnapshot>(
    () => ({
      checkout_enable_flat_rate_shipping: enabled,
      checkout_flat_rate_shipping_label: label,
      checkout_flat_rate_shipping_fee_cents: feeCents
    }),
    [enabled, label, feeCents]
  );

  const isDirty = baseline ? JSON.stringify(snapshot) !== JSON.stringify(baseline) : false;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), { cache: "no-store" });
      const payload = (await response.json()) as SettingsResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.settings) {
        setError(payload.error ?? "Unable to load shipping rules.");
        setLoading(false);
        return;
      }

      const next: ShippingSettingsSnapshot = {
        checkout_enable_flat_rate_shipping: payload.settings.checkout_enable_flat_rate_shipping ?? true,
        checkout_flat_rate_shipping_label: payload.settings.checkout_flat_rate_shipping_label ?? "Shipping",
        checkout_flat_rate_shipping_fee_cents: payload.settings.checkout_flat_rate_shipping_fee_cents ?? 0
      };

      setEnabled(next.checkout_enable_flat_rate_shipping);
      setLabel(next.checkout_flat_rate_shipping_label ?? "Shipping");
      setFeeCents(next.checkout_flat_rate_shipping_fee_cents);
      setBaseline(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  function discardChanges() {
    if (!baseline) {
      return;
    }

    setEnabled(baseline.checkout_enable_flat_rate_shipping);
    setLabel(baseline.checkout_flat_rate_shipping_label ?? "Shipping");
    setFeeCents(baseline.checkout_flat_rate_shipping_fee_cents);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      discardChanges();
      return;
    }

    const parsedFee = Number.parseInt(String(feeCents ?? 0), 10);
    if (!Number.isInteger(parsedFee) || parsedFee < 0) {
      setError("Shipping fee must be a non-negative integer amount in cents.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutEnableFlatRateShipping: enabled,
        checkoutFlatRateShippingLabel: label.trim() || null,
        checkoutFlatRateShippingFeeCents: parsedFee
      })
    });

    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      setError(payload.error ?? "Unable to save shipping rules.");
      setSaving(false);
      return;
    }

    const next: ShippingSettingsSnapshot = {
      checkout_enable_flat_rate_shipping: payload.settings.checkout_enable_flat_rate_shipping ?? enabled,
      checkout_flat_rate_shipping_label: payload.settings.checkout_flat_rate_shipping_label ?? (label.trim() || "Shipping"),
      checkout_flat_rate_shipping_fee_cents: payload.settings.checkout_flat_rate_shipping_fee_cents ?? parsedFee
    };

    setEnabled(next.checkout_enable_flat_rate_shipping);
    setLabel(next.checkout_flat_rate_shipping_label ?? "Shipping");
    setFeeCents(next.checkout_flat_rate_shipping_fee_cents);
    setBaseline(next);
    notify.success("Shipping rules saved.");
    setSaving(false);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading shipping rules...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <SectionCard title="Shipping Methods" description="Configure flat-rate shipping availability and base price.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                  Enable flat-rate shipping option
                </label>

                {enabled ? (
                  <>
                    <FormField label="Shipping Label">
                      <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Shipping" />
                    </FormField>
                    <FormField label="Shipping Fee (cents)">
                      <Input
                        type="number"
                        min={0}
                        value={feeCents}
                        onChange={(event) => setFeeCents(Number.parseInt(event.target.value || "0", 10))}
                      />
                    </FormField>
                  </>
                ) : null}
              </div>
            </SectionCard>

          </form>
        ) : null}
      </div>

      {!loading ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save shipping rules"
          savePendingLabel="Saving..."
          savePending={saving}
          saveDisabled={!isDirty || saving}
          discardDisabled={!isDirty || saving}
          statusMessage={error}
          statusVariant="error"
        />
      ) : null}
    </section>
  );
}
