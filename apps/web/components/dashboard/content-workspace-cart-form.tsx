"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { getStringValue } from "@/components/dashboard/store-experience-form-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";

type ContentWorkspaceCartFormProps = {
  header?: ReactNode;
};

export function ContentWorkspaceCartForm({ header }: ContentWorkspaceCartFormProps) {
  const formId = "content-workspace-cart-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("cartPage");

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

        <SectionCard title="Cart Header Copy" description="Top-of-page heading and supporting text for the cart experience.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Cart Title" description="Main heading at the top of the cart page.">
              <Input
                value={getStringValue(draft, "copy.cart.title")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.cart.title", event.target.value))}
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Cart Subtitle" description="Supporting text under the cart title.">
              <Textarea
                rows={2}
                value={getStringValue(draft, "copy.cart.subtitle")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.cart.subtitle", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Cart Actions and States" description="Button labels and empty-state messaging used in the cart flow.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Checkout Button Label" description="Primary CTA text used to continue to checkout.">
              <Input
                value={getStringValue(draft, "copy.cart.checkout")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.cart.checkout", event.target.value))}
              />
            </FormField>
            <FormField label="Empty Cart Message" description="Message shown when the shopper has no cart items.">
              <Input
                value={getStringValue(draft, "copy.cart.empty")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.cart.empty", event.target.value))}
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
