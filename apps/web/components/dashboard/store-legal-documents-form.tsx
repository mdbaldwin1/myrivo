"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { useStoreEditorDocument } from "@/components/dashboard/use-store-editor-document";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveStoreLegalDocument } from "@/lib/legal/store-documents";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { areEditorValuesEqual } from "@/lib/store-editor/object-path";
import { storeLegalDocumentsEditorSchema, type StoreLegalDocumentsEditorSnapshot } from "@/lib/store-editor/schemas";
import { getStoreLegalDocument } from "@/lib/storefront/store-legal-documents";
import { cn } from "@/lib/utils";

type StoreLegalDocumentsFormProps = {
  header?: ReactNode;
};

type ActiveDocumentKey = "privacy" | "terms";

type SettingsResponse = {
  documents?: StoreLegalDocumentsEditorSnapshot;
  store?: {
    name: string;
    slug: string;
    supportEmail: string | null;
  };
  error?: string;
};

type PublishDraftState = {
  changeSummary: string;
  effectiveAt: string;
};

const DOCUMENT_TABS: Array<{ id: ActiveDocumentKey; label: string; description: string }> = [
  {
    id: "privacy",
    label: "Privacy Policy",
    description: "How customer information is collected, used, and supported."
  },
  {
    id: "terms",
    label: "Terms & Conditions",
    description: "Purchase, storefront-use, and order-expectation terms."
  }
];

const DEFAULT_DOCUMENT_META: { id: ActiveDocumentKey; label: string; description: string } = {
  id: "privacy",
  label: "Privacy Policy",
  description: "How customer information is collected, used, and supported."
};

const DEFAULT_PUBLISH_STATE: Record<ActiveDocumentKey, PublishDraftState> = {
  privacy: { changeSummary: "", effectiveAt: "" },
  terms: { changeSummary: "", effectiveAt: "" }
};

export function StoreLegalDocumentsForm({ header }: StoreLegalDocumentsFormProps) {
  const formId = "store-legal-documents-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [activeDocument, setActiveDocument] = useState<ActiveDocumentKey>("privacy");
  const [storeContext, setStoreContext] = useState<{ name: string; slug: string; supportEmail: string | null } | null>(null);
  const [publishState, setPublishState] = useState<Record<ActiveDocumentKey, PublishDraftState>>(DEFAULT_PUBLISH_STATE);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const loadDocument = useCallback(async (): Promise<StoreLegalDocumentsEditorSnapshot> => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/legal-documents", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.documents) {
      throw new Error(payload.error ?? "Unable to load legal documents.");
    }

    if (payload.store) {
      setStoreContext({ name: payload.store.name, slug: payload.store.slug, supportEmail: payload.store.supportEmail });
    }

    return payload.documents;
  }, [storeSlug]);

  const saveDocument = useCallback(
    async (draft: StoreLegalDocumentsEditorSnapshot): Promise<StoreLegalDocumentsEditorSnapshot> => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/legal-documents", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok || !payload.documents) {
        throw new Error(payload.error ?? "Unable to save legal documents.");
      }

      return payload.documents;
    },
    [storeSlug]
  );

  const { draft, error, isDirty, loading, save, saving, setFieldValue, discardChanges, replaceDocument } =
    useStoreEditorDocument<StoreLegalDocumentsEditorSnapshot>({
      emptyDraft: {
        privacy: {
          source_mode: "template",
          title_override: "Privacy Policy",
          body_markdown: "",
          variables_json: {},
          published_source_mode: "template",
          published_template_version: "v1",
          published_title: "Privacy Policy",
          published_body_markdown: "",
          published_variables_json: {},
          published_version: 1,
          published_change_summary: null,
          effective_at: null,
          published_at: null
        },
        terms: {
          source_mode: "template",
          title_override: "Terms & Conditions",
          body_markdown: "",
          variables_json: {},
          published_source_mode: "template",
          published_template_version: "v1",
          published_title: "Terms & Conditions",
          published_body_markdown: "",
          published_variables_json: {},
          published_version: 1,
          published_change_summary: null,
          effective_at: null,
          published_at: null
        }
      },
      loadDocument,
      saveDocument,
      schema: storeLegalDocumentsEditorSchema,
      successMessage: "Legal document draft saved."
    });

  const activeDocumentDraft = draft[activeDocument];
  const activeDocumentMeta = useMemo(
    () => DOCUMENT_TABS.find((document) => document.id === activeDocument) ?? DEFAULT_DOCUMENT_META,
    [activeDocument]
  );
  const activeTemplateDefinition = useMemo(() => getStoreLegalDocument(activeDocument), [activeDocument]);
  const activeVariableDefinitions = activeTemplateDefinition.templateVariables;
  const activePublishState = publishState[activeDocument];
  const publishedComparison = useMemo(
    () => ({
      source_mode: activeDocumentDraft.published_source_mode,
      template_version: activeDocumentDraft.published_template_version,
      title_override: activeDocumentDraft.published_title,
      body_markdown: activeDocumentDraft.published_body_markdown,
      variables_json: activeDocumentDraft.published_variables_json
    }),
    [activeDocumentDraft]
  );
  const draftComparison = useMemo(
    () => ({
      source_mode: activeDocumentDraft.source_mode,
      template_version: "v1",
      title_override: activeDocumentDraft.title_override,
      body_markdown: activeDocumentDraft.body_markdown,
      variables_json: activeDocumentDraft.variables_json
    }),
    [activeDocumentDraft]
  );
  const hasUnpublishedChanges = useMemo(
    () => !areEditorValuesEqual(draftComparison, publishedComparison),
    [draftComparison, publishedComparison]
  );
  const activePreview = useMemo(() => {
    const previewStore = {
      name: storeContext?.name ?? "Your Store",
      slug: storeContext?.slug ?? "your-store"
    };
    const previewSettings = {
      support_email: storeContext?.supportEmail ?? "support@example.com"
    };
    return resolveStoreLegalDocument(activeDocument, previewStore, previewSettings, {
      source_mode: activeDocumentDraft.source_mode,
      template_version: "v1",
      title_override: activeDocumentDraft.title_override,
      body_markdown: activeDocumentDraft.body_markdown,
      variables_json: activeDocumentDraft.variables_json
    });
  }, [activeDocument, activeDocumentDraft, storeContext]);
  const activePublishedPreview = useMemo(() => {
    const previewStore = {
      name: storeContext?.name ?? "Your Store",
      slug: storeContext?.slug ?? "your-store"
    };
    const previewSettings = {
      support_email: storeContext?.supportEmail ?? "support@example.com"
    };
    return resolveStoreLegalDocument(activeDocument, previewStore, previewSettings, {
      source_mode: activeDocumentDraft.published_source_mode,
      template_version: activeDocumentDraft.published_template_version,
      title_override: activeDocumentDraft.published_title,
      body_markdown: activeDocumentDraft.published_body_markdown,
      variables_json: activeDocumentDraft.published_variables_json,
      published_version: activeDocumentDraft.published_version,
      published_at: activeDocumentDraft.published_at,
      effective_at: activeDocumentDraft.effective_at,
      published_change_summary: activeDocumentDraft.published_change_summary
    });
  }, [activeDocument, activeDocumentDraft, storeContext]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      discardChanges();
      return;
    }

    await save();
  }

  async function handlePublish() {
    if (saving || publishing || isDirty || !hasUnpublishedChanges) {
      return;
    }

    setPublishing(true);
    setPublishError(null);
    setPublishNotice(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/legal-documents", storeSlug), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeDocument,
          changeSummary: activePublishState.changeSummary.trim(),
          effectiveAt: activePublishState.effectiveAt ? new Date(activePublishState.effectiveAt).toISOString() : null
        })
      });
      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok || !payload.documents) {
        throw new Error(payload.error ?? "Unable to publish legal document.");
      }

      replaceDocument(payload.documents);
      setPublishState((current) => ({
        ...current,
        [activeDocument]: { changeSummary: "", effectiveAt: "" }
      }));
      setPublishNotice(`${activeDocumentMeta.label} published.`);
    } catch (publishFailure) {
      setPublishError(publishFailure instanceof Error ? publishFailure.message : "Unable to publish legal document.");
    } finally {
      setPublishing(false);
    }
  }

  const actionStatusMessage = publishError ?? error ?? publishNotice;
  const actionStatusVariant = publishError || error ? "error" : publishNotice ? "info" : "error";
  const publishDisabled =
    saving ||
    publishing ||
    isDirty ||
    !hasUnpublishedChanges ||
    activePublishState.changeSummary.trim().length < 8;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}

        <AppAlert
          variant="info"
          title="Formal legal documents live here"
          message="Use this page for your store's formal Privacy Policy and Terms & Conditions. Keep shipping, returns, support, and FAQ presentation in Storefront Studio."
        />

        <AppAlert
          variant="info"
          title="Drafts stay private until published"
          message="Saving here updates your draft only. Customers keep seeing the last published legal document until you publish an update with an effective date and change summary."
        />

        {storeContext ? (
          <AppAlert
            variant="info"
            title="Template defaults use store context"
            message={`Template placeholders resolve against ${storeContext.name}${storeContext.supportEmail ? ` and ${storeContext.supportEmail}` : ""}.`}
          />
        ) : null}

        {loading ? <p className="text-sm text-muted-foreground">Loading legal documents...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <SectionCard title="Documents" description="Choose which formal store document you are editing.">
              <div className="flex flex-wrap gap-2">
                {DOCUMENT_TABS.map((document) => {
                  const selected = document.id === activeDocument;
                  return (
                    <Button
                      key={document.id}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      onClick={() => setActiveDocument(document.id)}
                      className={cn("min-w-[11rem] justify-start", !selected && "bg-background")}
                    >
                      {document.label}
                    </Button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title={activeDocumentMeta.label} description={activeDocumentMeta.description}>
              <div className="space-y-4">
                <SectionCard
                  title="Publication status"
                  description="Legal updates are explicit. Save your draft first, then publish it when you are ready for customers to see the new version."
                >
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Published version</p>
                        <p className="mt-2 text-sm font-medium">v{activeDocumentDraft.published_version}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeDocumentDraft.published_at
                            ? `Published ${new Date(activeDocumentDraft.published_at).toLocaleString("en-US")}`
                            : "Not published yet"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeDocumentDraft.effective_at
                            ? `Effective ${new Date(activeDocumentDraft.effective_at).toLocaleString("en-US")}`
                            : "Effective immediately when published"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Change summary</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {activeDocumentDraft.published_change_summary?.trim() || "No publish summary has been recorded yet."}
                        </p>
                      </div>
                    </div>

                    <AppAlert
                      variant={isDirty ? "warning" : hasUnpublishedChanges ? "info" : "success"}
                      title={
                        isDirty
                          ? "Unsaved draft changes"
                          : hasUnpublishedChanges
                            ? "Saved draft changes are ready to publish"
                            : "Published storefront matches the current draft"
                      }
                      message={
                        isDirty
                          ? "Save your current draft before publishing. Publish actions only use the latest saved draft."
                          : hasUnpublishedChanges
                            ? "Customers are still seeing the previous published version until you publish this update."
                            : "There are no unpublished legal changes right now."
                      }
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField
                        label="Effective at"
                        description="Optional. Leave blank to make the published update effective immediately."
                      >
                        <Input
                          type="datetime-local"
                          value={activePublishState.effectiveAt}
                          onChange={(event) =>
                            setPublishState((current) => ({
                              ...current,
                              [activeDocument]: {
                                ...current[activeDocument],
                                effectiveAt: event.target.value
                              }
                            }))
                          }
                        />
                      </FormField>

                      <FormField
                        label="Publish summary"
                        description="Required. Record what changed so legal updates remain explainable later."
                      >
                        <Textarea
                          rows={4}
                          value={activePublishState.changeSummary}
                          onChange={(event) =>
                            setPublishState((current) => ({
                              ...current,
                              [activeDocument]: {
                                ...current[activeDocument],
                                changeSummary: event.target.value
                              }
                            }))
                          }
                          placeholder="Example: Added pickup-specific privacy contact details and clarified refund language."
                        />
                      </FormField>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Document mode" description="Template mode starts from Myrivo's default legal structure.">
                    <Select
                      value={activeDocumentDraft.source_mode}
                      onChange={(event) =>
                        setFieldValue(
                          `${activeDocument}.source_mode`,
                          event.target.value === "custom" ? "custom" : "template"
                        )
                      }
                    >
                      <option value="template">Template-backed</option>
                      <option value="custom">Fully custom</option>
                    </Select>
                  </FormField>

                  <FormField label="Document title" description="Shown on the public storefront legal page.">
                    <Input
                      value={activeDocumentDraft.title_override}
                      onChange={(event) => setFieldValue(`${activeDocument}.title_override`, event.target.value)}
                      placeholder={activeDocumentMeta.label}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Document body"
                  description={
                    activeDocumentDraft.source_mode === "template"
                      ? "Template mode keeps the default legal structure. Use variables first, then adjust the template text here only if you need an advanced override."
                      : "Custom mode gives you full control of the legal text. Placeholders like {storeName} and {supportEmail} still resolve automatically."
                  }
                >
                  <Textarea
                    rows={20}
                    value={activeDocumentDraft.body_markdown}
                    onChange={(event) => setFieldValue(`${activeDocument}.body_markdown`, event.target.value)}
                    placeholder={`Write your ${activeDocumentMeta.label.toLowerCase()} here...`}
                    className="font-mono text-sm"
                  />
                </FormField>

                {activeDocumentDraft.source_mode === "template" ? (
                  <SectionCard
                    title="Template variables"
                    description="These fields personalize the built-in legal template without forcing you to rewrite every clause."
                  >
                    <div className="grid gap-3">
                      {activeVariableDefinitions.map((variable) => (
                        <FormField
                          key={variable.key}
                          label={variable.label}
                          description={variable.description}
                        >
                          {variable.multiline ? (
                            <Textarea
                              rows={6}
                              value={activeDocumentDraft.variables_json[variable.key] ?? ""}
                              onChange={(event) =>
                                setFieldValue(`${activeDocument}.variables_json`, {
                                  ...activeDocumentDraft.variables_json,
                                  [variable.key]: event.target.value
                                })
                              }
                              placeholder={variable.placeholder}
                            />
                          ) : (
                            <Input
                              value={activeDocumentDraft.variables_json[variable.key] ?? ""}
                              onChange={(event) =>
                                setFieldValue(`${activeDocument}.variables_json`, {
                                  ...activeDocumentDraft.variables_json,
                                  [variable.key]: event.target.value
                                })
                              }
                              placeholder={variable.placeholder}
                            />
                          )}
                        </FormField>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                <SectionCard
                  title="Preview"
                  description="This is how the resolved legal document will appear on the storefront."
                >
                  <div className="space-y-4">
                    <div className="space-y-1 border-b border-border/40 pb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {storeContext?.name ?? "Your Store"}
                      </p>
                      <h3 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">
                        {activePreview.title}
                      </h3>
                    </div>
                    <LegalMarkdown content={activePreview.bodyMarkdown} />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Currently published"
                  description="This is the version customers can read right now."
                >
                  <div className="space-y-4">
                    <div className="space-y-1 border-b border-border/40 pb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {storeContext?.name ?? "Your Store"}
                      </p>
                      <h3 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">
                        {activePublishedPreview.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Version {activePublishedPreview.publishedVersion ?? 1}
                        {activePublishedPreview.effectiveAt
                          ? ` • Effective ${new Date(activePublishedPreview.effectiveAt).toLocaleDateString("en-US")}`
                          : ""}
                      </p>
                    </div>
                    <LegalMarkdown content={activePublishedPreview.bodyMarkdown} />
                  </div>
                </SectionCard>
              </div>
            </SectionCard>
          </form>
        ) : null}
      </div>

      {!loading ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save legal documents"
          savePendingLabel="Saving..."
          savePending={saving}
          saveDisabled={!isDirty || saving}
          discardDisabled={!isDirty || saving}
          statusMessage={actionStatusMessage}
          statusVariant={actionStatusVariant}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => void handlePublish()}
              disabled={publishDisabled}
            >
              {publishing ? "Publishing..." : `Publish ${activeDocumentMeta.label}`}
            </Button>
          }
        />
      ) : null}
    </section>
  );
}
