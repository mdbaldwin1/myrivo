"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import {
  createId,
  getStringValue,
  parsePolicyFaqs,
  type PolicyFaqDraft
} from "@/components/dashboard/store-experience-form-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";
import { Button } from "@/components/ui/button";

type ContentWorkspacePoliciesFormProps = {
  header?: ReactNode;
};

export function ContentWorkspacePoliciesForm({ header }: ContentWorkspacePoliciesFormProps) {
  const formId = "content-workspace-policies-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("policiesPage");
  const policyFaqs = parsePolicyFaqs(draft.policyFaqs);
  const normalizePolicyFaqOrder = (faqs: PolicyFaqDraft[]) => faqs.map((entry, index) => ({ ...entry, sortOrder: index }));
  const movePolicyFaq = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= policyFaqs.length) {
      return;
    }
    const next = [...policyFaqs];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    next.splice(toIndex, 0, moved);
    setDraft((current) => setAtPath(current, "policyFaqs", normalizePolicyFaqOrder(next)));
  };

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

        <SectionCard title="Policies" description="Shipping, returns, and support contact content.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Support Email" description="Displayed in policy/support sections.">
              <Input
                value={getStringValue(draft, "supportEmail")}
                onChange={(event) => setDraft((current) => setAtPath(current, "supportEmail", event.target.value))}
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Shipping Policy" description="Policy text shown in the shipping section.">
              <Textarea
                rows={6}
                value={getStringValue(draft, "shippingPolicy")}
                onChange={(event) => setDraft((current) => setAtPath(current, "shippingPolicy", event.target.value))}
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Return Policy" description="Policy text shown in the returns section.">
              <Textarea
                rows={6}
                value={getStringValue(draft, "returnPolicy")}
                onChange={(event) => setDraft((current) => setAtPath(current, "returnPolicy", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="Policy FAQs"
          description="Manage the ordered FAQ items shown in the policies page question-and-answer section."
        >
          <div className="space-y-3">
            {policyFaqs.map((faq, index) => (
              <div key={faq.id} className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">FAQ {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => movePolicyFaq(index, index - 1)}>
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === policyFaqs.length - 1}
                      onClick={() => movePolicyFaq(index, index + 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = policyFaqs.filter((entry) => entry.id !== faq.id);
                        setDraft((current) => setAtPath(current, "policyFaqs", normalizePolicyFaqOrder(next)));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <FormField label="Question" description="Customer-facing question text.">
                  <Input
                    placeholder="Question"
                    value={faq.question}
                    onChange={(event) => {
                      const next = policyFaqs.map((entry) =>
                        entry.id === faq.id ? { ...entry, question: event.target.value } : entry
                      );
                      setDraft((current) => setAtPath(current, "policyFaqs", next));
                    }}
                  />
                </FormField>
                <FormField label="Answer" description="Answer shown when this FAQ item is expanded.">
                  <Textarea
                    rows={3}
                    placeholder="Answer"
                    value={faq.answer}
                    onChange={(event) => {
                      const next = policyFaqs.map((entry) =>
                        entry.id === faq.id ? { ...entry, answer: event.target.value } : entry
                      );
                      setDraft((current) => setAtPath(current, "policyFaqs", next));
                    }}
                  />
                </FormField>
                <div className="grid gap-2 sm:grid-cols-2">
                  <FormField label="Sort Order" description="Lower numbers appear earlier in the FAQ list.">
                    <Input
                      type="number"
                      placeholder="Sort order"
                      value={faq.sortOrder}
                      onChange={(event) => {
                        const next = policyFaqs.map((entry) =>
                          entry.id === faq.id ? { ...entry, sortOrder: Number.parseInt(event.target.value || "0", 10) || 0 } : entry
                        );
                        setDraft((current) => setAtPath(current, "policyFaqs", next));
                      }}
                    />
                  </FormField>
                  <FormField label="Active" description="Inactive FAQs are hidden from storefront visitors.">
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={faq.isActive}
                        onChange={(event) => {
                          const next = policyFaqs.map((entry) =>
                            entry.id === faq.id ? { ...entry, isActive: event.target.checked } : entry
                          );
                          setDraft((current) => setAtPath(current, "policyFaqs", next));
                        }}
                      />
                      Enabled
                    </label>
                  </FormField>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next: PolicyFaqDraft[] = [
                  ...policyFaqs,
                  { id: createId("faq"), question: "", answer: "", sortOrder: policyFaqs.length, isActive: true }
                ];
                setDraft((current) => setAtPath(current, "policyFaqs", normalizePolicyFaqOrder(next)));
              }}
            >
              Add FAQ
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Policies Copy"
          description="Edit customer-facing page title, subtitle, and section headings for the policies experience."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Page Title" description="Main headline shown at the top of the policies page.">
              <Input
                value={getStringValue(draft, "copy.policies.title")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.policies.title", event.target.value))}
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Page Subtitle" description="Short supporting intro under the page title.">
              <Textarea
                rows={3}
                value={getStringValue(draft, "copy.policies.subtitle")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.policies.subtitle", event.target.value))}
              />
            </FormField>
            <FormField label="Shipping Section Heading" description="Heading above the shipping policy content block.">
              <Input
                value={getStringValue(draft, "copy.policies.shippingHeading")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.policies.shippingHeading", event.target.value))}
              />
            </FormField>
            <FormField label="Returns Section Heading" description="Heading above the returns policy content block.">
              <Input
                value={getStringValue(draft, "copy.policies.returnsHeading")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.policies.returnsHeading", event.target.value))}
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
