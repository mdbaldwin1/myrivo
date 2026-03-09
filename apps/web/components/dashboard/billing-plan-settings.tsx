"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type BillingPlanConfigResponse = {
  billing?: {
    billing_plans?: { key: string; name: string; transaction_fee_bps: number; transaction_fee_fixed_cents: number } | null;
  };
  plans?: Array<{ key: string; name: string; monthly_price_cents: number; transaction_fee_bps: number; transaction_fee_fixed_cents: number }>;
  canManageBillingPlan?: boolean;
  error?: string;
};

type BillingPlanSettingsProps = {
  title?: string;
  editable?: boolean;
};

export function BillingPlanSettings({ title = "Billing Plan", editable = false }: BillingPlanSettingsProps) {
  const formId = "billing-plan-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingPlanKey, setBillingPlanKey] = useState("standard");
  const [savedBillingPlanKey, setSavedBillingPlanKey] = useState("standard");
  const [plans, setPlans] = useState<BillingPlanConfigResponse["plans"]>([]);
  const [canManageBillingPlan, setCanManageBillingPlan] = useState(false);
  const [assignedPlanLabel, setAssignedPlanLabel] = useState<string | null>(null);

  const effectiveEditable = editable && canManageBillingPlan;
  const isDirty = billingPlanKey !== savedBillingPlanKey;

  const selectedPlan = useMemo(() => plans?.find((plan) => plan.key === billingPlanKey) ?? null, [billingPlanKey, plans]);
  const billingHelper = selectedPlan
    ? `${(selectedPlan.transaction_fee_bps / 100).toFixed(2)}% + $${(selectedPlan.transaction_fee_fixed_cents / 100).toFixed(2)} per successful order`
    : "";

  async function fetchConfig() {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/platform-config", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as BillingPlanConfigResponse;
    return { ok: response.ok, payload };
  }

  function normalizeBillingPlan(
    raw: BillingPlanConfigResponse["billing"] extends { billing_plans?: infer T } ? T : unknown
  ): { key: string; name: string; transaction_fee_bps: number; transaction_fee_fixed_cents: number } | null {
    if (!raw) {
      return null;
    }
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    if (!key) {
      return null;
    }
    return {
      key,
      name: typeof record.name === "string" && record.name.trim() ? record.name : key,
      transaction_fee_bps: typeof record.transaction_fee_bps === "number" ? record.transaction_fee_bps : 0,
      transaction_fee_fixed_cents: typeof record.transaction_fee_fixed_cents === "number" ? record.transaction_fee_fixed_cents : 0
    };
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchConfig();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.payload.error ?? "Unable to load billing plan.");
        setLoading(false);
        return;
      }

      const currentPlan = normalizeBillingPlan(result.payload.billing?.billing_plans);
      const activePlanKey = currentPlan?.key ?? result.payload.plans?.[0]?.key ?? "standard";
      const basePlans = result.payload.plans ?? [];
      const mergedPlans =
        currentPlan && !basePlans.some((plan) => plan.key === currentPlan.key)
          ? [
              ...basePlans,
              {
                key: currentPlan.key,
                name: currentPlan.name,
                monthly_price_cents: 0,
                transaction_fee_bps: currentPlan.transaction_fee_bps,
                transaction_fee_fixed_cents: currentPlan.transaction_fee_fixed_cents
              }
            ]
          : basePlans;
      setPlans(mergedPlans);
      setBillingPlanKey(activePlanKey);
      setSavedBillingPlanKey(activePlanKey);
      setCanManageBillingPlan(Boolean(result.payload.canManageBillingPlan));
      setAssignedPlanLabel(currentPlan?.name ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setBillingPlanKey(savedBillingPlanKey);
      setError(null);
      return;
    }

    if (!effectiveEditable || !isDirty) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/platform-config", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingPlanKey })
    });
    const payload = (await response.json()) as BillingPlanConfigResponse;

    if (!response.ok) {
      setError(payload.error ?? "Unable to save billing plan.");
      setSaving(false);
      return;
    }

    setSavedBillingPlanKey(billingPlanKey);
    notify.success("Billing plan saved.");
    setSaving(false);
  }

  return (
    <SectionCard title={title}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading billing plan...</p> : null}
        <FormField
          label="Assigned Plan"
          description={billingHelper || "Plan determines the platform fee charged per successful order, on top of Stripe fees."}
        >
          {effectiveEditable ? (
            <Select value={billingPlanKey} onChange={(event) => setBillingPlanKey(event.target.value)} disabled={loading || saving}>
              {(plans ?? []).map((plan) => (
                <option key={plan.key} value={plan.key}>
                  {plan.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={assignedPlanLabel ?? billingPlanKey.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
              readOnly
              disabled
            />
          )}
        </FormField>

        {!effectiveEditable ? (
          <p className="text-xs text-muted-foreground">Plan assignment is managed by platform admins.</p>
        ) : null}
        {effectiveEditable ? (
          <DashboardFormActionBar
            formId={formId}
            saveLabel="Save billing plan"
            savePendingLabel="Saving..."
            savePending={saving}
            saveDisabled={saving || loading || !isDirty}
            discardDisabled={saving || loading || !isDirty}
            statusMessage={error}
            statusVariant="error"
          />
        ) : null}
      </form>
    </SectionCard>
  );
}
