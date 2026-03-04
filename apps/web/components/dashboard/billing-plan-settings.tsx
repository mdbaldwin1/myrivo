"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingPlanKey, setBillingPlanKey] = useState("standard");
  const [savedBillingPlanKey, setSavedBillingPlanKey] = useState("standard");
  const [plans, setPlans] = useState<BillingPlanConfigResponse["plans"]>([]);
  const [canManageBillingPlan, setCanManageBillingPlan] = useState(false);

  const effectiveEditable = editable && canManageBillingPlan;
  const isDirty = billingPlanKey !== savedBillingPlanKey;

  const selectedPlan = useMemo(() => plans?.find((plan) => plan.key === billingPlanKey) ?? null, [billingPlanKey, plans]);
  const billingHelper = selectedPlan
    ? `${(selectedPlan.transaction_fee_bps / 100).toFixed(2)}% + $${(selectedPlan.transaction_fee_fixed_cents / 100).toFixed(2)} per successful order`
    : "";

  async function fetchConfig() {
    const response = await fetch("/api/stores/platform-config", { cache: "no-store" });
    const payload = (await response.json()) as BillingPlanConfigResponse;
    return { ok: response.ok, payload };
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

      const activePlanKey = result.payload.billing?.billing_plans?.key ?? result.payload.plans?.[0]?.key ?? "standard";
      setPlans(result.payload.plans ?? []);
      setBillingPlanKey(activePlanKey);
      setSavedBillingPlanKey(activePlanKey);
      setCanManageBillingPlan(Boolean(result.payload.canManageBillingPlan));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    const response = await fetch("/api/stores/platform-config", {
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
          <Select value={billingPlanKey} onChange={(event) => setBillingPlanKey(event.target.value)} disabled={!effectiveEditable || loading || saving}>
            {(plans ?? []).map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.name}
              </option>
            ))}
          </Select>
        </FormField>

        {!effectiveEditable ? (
          <p className="text-xs text-muted-foreground">Plan assignment is managed by platform admins.</p>
        ) : null}

        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save billing plan"
          savePendingLabel="Saving..."
          savePending={saving}
          saveDisabled={!effectiveEditable || saving || loading || !isDirty}
          discardDisabled={!effectiveEditable || saving || loading || !isDirty}
        />
        <FeedbackMessage type="error" message={error} />
      </form>
    </SectionCard>
  );
}
