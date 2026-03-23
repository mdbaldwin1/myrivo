"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { StorePrivacyRequestsPanel } from "@/components/dashboard/store-privacy-requests-panel";
import { useStoreEditorDocument } from "@/components/dashboard/use-store-editor-document";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { storePrivacyComplianceEditorSchema, type StorePrivacyComplianceEditorSnapshot } from "@/lib/store-editor/schemas";

type StorePrivacySettingsFormProps = {
  header?: ReactNode;
};

type SettingsResponse = {
  settings?: StorePrivacyComplianceEditorSnapshot;
  store?: {
    name: string;
    slug: string;
    supportEmail: string | null;
  };
  error?: string;
};

export function StorePrivacySettingsForm({ header }: StorePrivacySettingsFormProps) {
  const formId = "store-privacy-settings-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [storeContext, setStoreContext] = useState<{ name: string; slug: string; supportEmail: string | null } | null>(null);

  const loadDocument = useCallback(async (): Promise<StorePrivacyComplianceEditorSnapshot> => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/privacy-settings", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.settings) {
      throw new Error(payload.error ?? "Unable to load privacy settings.");
    }

    if (payload.store) {
      setStoreContext(payload.store);
    }

    return payload.settings;
  }, [storeSlug]);

  const saveDocument = useCallback(
    async (draft: StorePrivacyComplianceEditorSnapshot): Promise<StorePrivacyComplianceEditorSnapshot> => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/privacy-settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Unable to save privacy settings.");
      }

      return payload.settings;
    },
    [storeSlug]
  );

  const { draft, error, isDirty, loading, save, saving, setFieldValue, discardChanges } =
    useStoreEditorDocument<StorePrivacyComplianceEditorSnapshot>({
      emptyDraft: {
        privacy_contact_email: "",
        privacy_rights_email: "",
        privacy_contact_name: "Privacy team",
        collection_notice_addendum_markdown: "",
        california_notice_markdown: "",
        do_not_sell_markdown: "",
        request_page_intro_markdown: ""
      },
      loadDocument,
      saveDocument,
      schema: storePrivacyComplianceEditorSchema,
      successMessage: "Privacy settings saved."
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}

        {loading ? <p className="text-sm text-muted-foreground">Loading privacy settings...</p> : null}

        {!loading ? (
          <div className="space-y-4">
            <form id={formId} onSubmit={handleSubmit} className="space-y-4">
              <SectionCard title="Privacy contacts" description="Set the store-specific contacts shown on privacy disclosures and shopper request surfaces.">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Privacy contact email"
                      description="Shown on privacy disclosures and used as the main privacy contact if rights contact is left blank."
                    >
                      <Input
                        type="email"
                        value={draft.privacy_contact_email}
                        onChange={(event) => setFieldValue("privacy_contact_email", event.target.value)}
                        placeholder={storeContext?.supportEmail ?? "privacy@example.com"}
                      />
                    </FormField>

                    <FormField
                      label="Privacy rights contact email"
                      description="Shown on rights-request surfaces and used for California/privacy requests."
                    >
                      <Input
                        type="email"
                        value={draft.privacy_rights_email}
                        onChange={(event) => setFieldValue("privacy_rights_email", event.target.value)}
                        placeholder={draft.privacy_contact_email || storeContext?.supportEmail || "privacy@example.com"}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Privacy contact name"
                    description="Friendly label shown on privacy request pages and privacy-rights sections."
                  >
                    <Input
                      value={draft.privacy_contact_name}
                      onChange={(event) => setFieldValue("privacy_contact_name", event.target.value)}
                      placeholder="Privacy team"
                    />
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard
                title="Store-specific privacy copy"
                description="Add store-specific disclosures on top of the platform-managed privacy experience."
              >
                <div className="space-y-4">
                  <FormField
                    label="Collection notice addendum"
                    description="Optional extra markdown appended below the shared privacy notice on collection surfaces."
                  >
                    <Textarea
                      rows={5}
                      value={draft.collection_notice_addendum_markdown}
                      onChange={(event) => setFieldValue("collection_notice_addendum_markdown", event.target.value)}
                      placeholder="Optional extra collection notice details for this storefront."
                    />
                  </FormField>

                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="California notice addendum"
                      description="Optional extra markdown for California-specific rights language when that platform surface is enabled."
                    >
                      <Textarea
                        rows={6}
                        value={draft.california_notice_markdown}
                        onChange={(event) => setFieldValue("california_notice_markdown", event.target.value)}
                        placeholder="Optional California-specific rights details."
                      />
                    </FormField>

                    <FormField
                      label="Privacy request page intro"
                      description="Optional introduction shown above the shopper privacy request form."
                    >
                      <Textarea
                        rows={6}
                        value={draft.request_page_intro_markdown}
                        onChange={(event) => setFieldValue("request_page_intro_markdown", event.target.value)}
                        placeholder="Explain how privacy requests are handled and when customers should use this form."
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Do Not Sell / Share addendum"
                    description="Optional extra markdown shown anywhere the do-not-sell/share rights surface appears."
                  >
                    <Textarea
                      rows={5}
                      value={draft.do_not_sell_markdown}
                      onChange={(event) => setFieldValue("do_not_sell_markdown", event.target.value)}
                      placeholder="Optional opt-out language for California rights surfaces."
                    />
                  </FormField>
                </div>
              </SectionCard>
            </form>

            <StorePrivacyRequestsPanel />
          </div>
        ) : null}
      </div>

      {!loading ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save privacy settings"
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
