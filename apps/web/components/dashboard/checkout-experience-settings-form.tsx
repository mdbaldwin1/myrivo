"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";

type CheckoutExperienceSnapshot = {
  checkout_allow_order_note: boolean;
  checkout_order_note_prompt: string | null;
};

type SettingsResponse = {
  settings?: Partial<CheckoutExperienceSnapshot>;
  error?: string;
};

type CheckoutExperienceSettingsFormProps = {
  header?: ReactNode;
};

export function CheckoutExperienceSettingsForm({ header }: CheckoutExperienceSettingsFormProps) {
  const formId = "checkout-experience-form";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allowOrderNote, setAllowOrderNote] = useState(false);
  const [orderNotePrompt, setOrderNotePrompt] = useState("Add any special requests for your order.");
  const [baseline, setBaseline] = useState<CheckoutExperienceSnapshot | null>(null);

  const snapshot = useMemo<CheckoutExperienceSnapshot>(
    () => ({
      checkout_allow_order_note: allowOrderNote,
      checkout_order_note_prompt: orderNotePrompt
    }),
    [allowOrderNote, orderNotePrompt]
  );

  const isDirty = baseline ? JSON.stringify(snapshot) !== JSON.stringify(baseline) : false;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/stores/settings", { cache: "no-store" });
      const payload = (await response.json()) as SettingsResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.settings) {
        setError(payload.error ?? "Unable to load checkout experience settings.");
        setLoading(false);
        return;
      }

      const next: CheckoutExperienceSnapshot = {
        checkout_allow_order_note: payload.settings.checkout_allow_order_note ?? false,
        checkout_order_note_prompt: payload.settings.checkout_order_note_prompt ?? "Add any special requests for your order."
      };

      setAllowOrderNote(next.checkout_allow_order_note);
      setOrderNotePrompt(next.checkout_order_note_prompt ?? "Add any special requests for your order.");
      setBaseline(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function discardChanges() {
    if (!baseline) {
      return;
    }

    setAllowOrderNote(baseline.checkout_allow_order_note);
    setOrderNotePrompt(baseline.checkout_order_note_prompt ?? "Add any special requests for your order.");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      discardChanges();
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutAllowOrderNote: allowOrderNote,
        checkoutOrderNotePrompt: orderNotePrompt.trim() || null
      })
    });

    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      setError(payload.error ?? "Unable to save checkout experience settings.");
      setSaving(false);
      return;
    }

    const next: CheckoutExperienceSnapshot = {
      checkout_allow_order_note: payload.settings.checkout_allow_order_note ?? allowOrderNote,
      checkout_order_note_prompt: payload.settings.checkout_order_note_prompt ?? (orderNotePrompt.trim() || null)
    };

    setAllowOrderNote(next.checkout_allow_order_note);
    setOrderNotePrompt(next.checkout_order_note_prompt ?? "Add any special requests for your order.");
    setBaseline(next);
    notify.success("Checkout experience settings saved.");
    setSaving(false);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading checkout experience settings...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <SectionCard title="Checkout Form Fields" description="Configure optional customer note behavior in checkout.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox checked={allowOrderNote} onChange={(event) => setAllowOrderNote(event.target.checked)} />
                  Allow buyer order note
                </label>
                {allowOrderNote ? (
                  <FormField className="sm:col-span-2" label="Order Note Prompt">
                    <Input
                      value={orderNotePrompt}
                      onChange={(event) => setOrderNotePrompt(event.target.value)}
                      placeholder="Add any special requests for your order."
                    />
                  </FormField>
                ) : null}
              </div>
            </SectionCard>

          </form>
        ) : null}
      </div>

      {!loading ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save checkout experience"
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
