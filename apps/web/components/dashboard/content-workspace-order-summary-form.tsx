"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { getStringValue } from "@/components/dashboard/store-experience-form-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";

type ContentWorkspaceOrderSummaryFormProps = {
  header?: ReactNode;
};

export function ContentWorkspaceOrderSummaryForm({ header }: ContentWorkspaceOrderSummaryFormProps) {
  const formId = "content-workspace-order-summary-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("orderSummaryPage");

  return (
    <form
      id={formId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "discard") {
          discard();
          return;
        }
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}

        <SectionCard title="Checkout Page Header" description="Primary heading copy for the order summary screen.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Checkout Page Title" description="Main heading shown on the order confirmation page.">
              <Input
                value={getStringValue(draft, "copy.checkout.title")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.checkout.title", event.target.value))}
              />
            </FormField>
            <FormField label="Cancelled Message" description="Message shown when checkout is cancelled or exited.">
              <Input
                value={getStringValue(draft, "copy.checkout.cancelled")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.checkout.cancelled", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Order Outcome Messages" description="Success and failure copy used after checkout finalization.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Order Placed Template" description="Supports {orderId}.">
              <Input
                value={getStringValue(draft, "copy.checkout.orderPlacedTemplate")}
                onChange={(event) =>
                  setDraft((current) => setAtPath(current, "copy.checkout.orderPlacedTemplate", event.target.value))
                }
              />
            </FormField>
            <FormField
              className="sm:col-span-2"
              label="Finalization Failed Message"
              description="Fallback message shown when order confirmation fails."
            >
              <Input
                value={getStringValue(draft, "copy.checkout.finalizationFailed")}
                onChange={(event) =>
                  setDraft((current) => setAtPath(current, "copy.checkout.finalizationFailed", event.target.value))
                }
              />
            </FormField>
          </div>
        </SectionCard>

      </div>
      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save"
        savePendingLabel="Saving..."
        discardLabel="Discard"
        savePending={saving}
        saveDisabled={!isDirty || saving || loading}
        discardDisabled={!isDirty || saving || loading}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
