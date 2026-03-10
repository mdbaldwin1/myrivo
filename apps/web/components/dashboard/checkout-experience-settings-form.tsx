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
import { checkoutExperienceEditorSchema, type CheckoutExperienceEditorSnapshot } from "@/lib/store-editor/schemas";

type SettingsResponse = {
  settings?: Partial<CheckoutExperienceEditorSnapshot>;
  error?: string;
};

type CheckoutExperienceSettingsFormProps = {
  header?: ReactNode;
};

export function CheckoutExperienceSettingsForm({ header }: CheckoutExperienceSettingsFormProps) {
  const formId = "checkout-experience-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const loadDocument = useCallback(async (): Promise<CheckoutExperienceEditorSnapshot> => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      throw new Error(payload.error ?? "Unable to load checkout experience settings.");
    }

    return {
      checkout_allow_order_note: payload.settings.checkout_allow_order_note ?? false,
      checkout_order_note_prompt: payload.settings.checkout_order_note_prompt ?? "Add any special requests for your order."
    };
  }, [storeSlug]);

  const saveDocument = useCallback(
    async (draft: CheckoutExperienceEditorSnapshot): Promise<CheckoutExperienceEditorSnapshot> => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutAllowOrderNote: draft.checkout_allow_order_note,
          checkoutOrderNotePrompt: draft.checkout_order_note_prompt.trim() || null
        })
      });

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Unable to save checkout experience settings.");
      }

      return {
        checkout_allow_order_note: payload.settings.checkout_allow_order_note ?? draft.checkout_allow_order_note,
        checkout_order_note_prompt:
          payload.settings.checkout_order_note_prompt ?? (draft.checkout_order_note_prompt.trim() || "Add any special requests for your order.")
      };
    },
    [storeSlug]
  );

  const { draft, error, isDirty, loading, save, saving, setFieldValue, discardChanges } =
    useStoreEditorDocument<CheckoutExperienceEditorSnapshot>({
      emptyDraft: {
        checkout_allow_order_note: false,
        checkout_order_note_prompt: "Add any special requests for your order."
      },
      loadDocument,
      saveDocument,
      schema: checkoutExperienceEditorSchema,
      successMessage: "Checkout experience settings saved."
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
        {loading ? <p className="text-sm text-muted-foreground">Loading checkout experience settings...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <SectionCard title="Checkout Form Fields" description="Configure optional customer note behavior in checkout.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.checkout_allow_order_note}
                    onChange={(event) => setFieldValue("checkout_allow_order_note", event.target.checked)}
                  />
                  Allow buyer order note
                </label>
                {draft.checkout_allow_order_note ? (
                  <FormField className="sm:col-span-2" label="Order Note Prompt">
                    <Input
                      value={draft.checkout_order_note_prompt}
                      onChange={(event) => setFieldValue("checkout_order_note_prompt", event.target.value)}
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
