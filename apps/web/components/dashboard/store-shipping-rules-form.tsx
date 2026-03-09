"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { useStoreEditorDocument } from "@/components/dashboard/use-store-editor-document";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { shippingRulesEditorSchema, type ShippingRulesEditorSnapshot } from "@/lib/store-editor/schemas";

type SettingsResponse = {
  settings?: Partial<ShippingRulesEditorSnapshot>;
  error?: string;
};

type StoreShippingRulesFormProps = {
  header?: ReactNode;
};

export function StoreShippingRulesForm({ header }: StoreShippingRulesFormProps) {
  const formId = "shipping-rules-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const loadDocument = useCallback(async (): Promise<ShippingRulesEditorSnapshot> => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      throw new Error(payload.error ?? "Unable to load shipping rules.");
    }

    return {
      checkout_enable_flat_rate_shipping: payload.settings.checkout_enable_flat_rate_shipping ?? true,
      checkout_flat_rate_shipping_label: payload.settings.checkout_flat_rate_shipping_label ?? "Shipping",
      checkout_flat_rate_shipping_fee_cents: payload.settings.checkout_flat_rate_shipping_fee_cents ?? 0
    };
  }, [storeSlug]);

  const saveDocument = useCallback(
    async (draft: ShippingRulesEditorSnapshot): Promise<ShippingRulesEditorSnapshot> => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutEnableFlatRateShipping: draft.checkout_enable_flat_rate_shipping,
          checkoutFlatRateShippingLabel: draft.checkout_flat_rate_shipping_label.trim() || null,
          checkoutFlatRateShippingFeeCents: draft.checkout_flat_rate_shipping_fee_cents
        })
      });

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Unable to save shipping rules.");
      }

      return {
        checkout_enable_flat_rate_shipping:
          payload.settings.checkout_enable_flat_rate_shipping ?? draft.checkout_enable_flat_rate_shipping,
        checkout_flat_rate_shipping_label:
          payload.settings.checkout_flat_rate_shipping_label ?? (draft.checkout_flat_rate_shipping_label.trim() || "Shipping"),
        checkout_flat_rate_shipping_fee_cents:
          payload.settings.checkout_flat_rate_shipping_fee_cents ?? draft.checkout_flat_rate_shipping_fee_cents
      };
    },
    [storeSlug]
  );

  const { draft, error, isDirty, loading, save, saving, setFieldValue, discardChanges } =
    useStoreEditorDocument<ShippingRulesEditorSnapshot>({
      emptyDraft: {
        checkout_enable_flat_rate_shipping: true,
        checkout_flat_rate_shipping_label: "Shipping",
        checkout_flat_rate_shipping_fee_cents: 0
      },
      loadDocument,
      saveDocument,
      schema: shippingRulesEditorSchema,
      successMessage: "Shipping rules saved."
    });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      discardChanges();
      return;
    }
    await save();
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
                  <Checkbox
                    checked={draft.checkout_enable_flat_rate_shipping}
                    onChange={(event) => setFieldValue("checkout_enable_flat_rate_shipping", event.target.checked)}
                  />
                  Enable flat-rate shipping option
                </label>

                {draft.checkout_enable_flat_rate_shipping ? (
                  <>
                    <FormField label="Shipping Label">
                      <Input
                        value={draft.checkout_flat_rate_shipping_label}
                        onChange={(event) => setFieldValue("checkout_flat_rate_shipping_label", event.target.value)}
                        placeholder="Shipping"
                      />
                    </FormField>
                    <FormField label="Shipping Fee (cents)">
                      <Input
                        type="number"
                        min={0}
                        value={draft.checkout_flat_rate_shipping_fee_cents}
                        onChange={(event) =>
                          setFieldValue("checkout_flat_rate_shipping_fee_cents", Number.parseInt(event.target.value || "0", 10))
                        }
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
