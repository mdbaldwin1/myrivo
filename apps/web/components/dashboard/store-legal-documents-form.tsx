"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { StoreLegalDocumentPreviewDialog } from "@/components/dashboard/store-legal-document-preview-dialog";
import { StoreLegalDocumentPublishDialog } from "@/components/dashboard/store-legal-document-publish-dialog";
import { StoreLegalDocumentVersionsTable } from "@/components/dashboard/store-legal-document-versions-table";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { useStoreEditorDocument } from "@/components/dashboard/use-store-editor-document";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { resolveStoreLegalDocument, type StoreLegalDocumentVersionRow } from "@/lib/legal/store-documents";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { storeLegalDocumentsContentEditorSchema, type StoreLegalDocumentsContentEditorSnapshot } from "@/lib/store-editor/schemas";
import { getStoreLegalDocument } from "@/lib/storefront/store-legal-documents";
import { cn } from "@/lib/utils";

type StoreLegalDocumentsFormProps = {
  header?: ReactNode;
};

type ActiveDocumentKey = "privacy" | "terms";

type BaseTemplatePayload = {
  versionId: string;
  versionLabel: string;
  title: string;
  bodyMarkdown: string;
  publishedAt: string | null;
  effectiveAt: string | null;
};

type SettingsResponse = {
  documents?: StoreLegalDocumentsContentEditorSnapshot;
  baseTemplates?: Record<ActiveDocumentKey, BaseTemplatePayload | null>;
  versions?: Record<ActiveDocumentKey, StoreLegalDocumentVersionRow[]>;
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
    description: "Base policy language comes from Myrivo admin legal governance. You configure store-specific details and addenda here."
  },
  {
    id: "terms",
    label: "Terms & Conditions",
    description: "Base terms language comes from Myrivo admin legal governance. You configure store-specific details and addenda here."
  }
];

const DEFAULT_PUBLISH_STATE: Record<ActiveDocumentKey, PublishDraftState> = {
  privacy: { changeSummary: "", effectiveAt: "" },
  terms: { changeSummary: "", effectiveAt: "" }
};

function buildEmptyEntry(): StoreLegalDocumentsContentEditorSnapshot["privacy"] {
  return {
    variables_json: {},
    addendum_markdown: "",
    published_title: "",
    published_body_markdown: "",
    published_variables_json: {},
    published_addendum_markdown: "",
    published_base_version_label: null,
    published_version: 1,
    published_change_summary: null,
    effective_at: null,
    published_at: null
  };
}

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
  const [versionHistory, setVersionHistory] = useState<Record<ActiveDocumentKey, StoreLegalDocumentVersionRow[]>>({ privacy: [], terms: [] });
  const [baseTemplates, setBaseTemplates] = useState<Record<ActiveDocumentKey, BaseTemplatePayload | null>>({
    privacy: null,
    terms: null
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPublishedPreviewOpen, setIsPublishedPreviewOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  const loadDocument = useCallback(async (): Promise<StoreLegalDocumentsContentEditorSnapshot> => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/legal-documents", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as SettingsResponse;

    if (!response.ok || !payload.documents) {
      throw new Error(payload.error ?? "Unable to load legal documents.");
    }

    if (payload.store) {
      setStoreContext({ name: payload.store.name, slug: payload.store.slug, supportEmail: payload.store.supportEmail });
    }
    if (payload.versions) {
      setVersionHistory(payload.versions);
    }
    if (payload.baseTemplates) {
      setBaseTemplates(payload.baseTemplates);
    }

    return payload.documents;
  }, [storeSlug]);

  const saveDocument = useCallback(
    async (draft: StoreLegalDocumentsContentEditorSnapshot): Promise<StoreLegalDocumentsContentEditorSnapshot> => {
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
    useStoreEditorDocument<StoreLegalDocumentsContentEditorSnapshot>({
      emptyDraft: {
        privacy: buildEmptyEntry(),
        terms: buildEmptyEntry()
      },
      loadDocument,
      saveDocument,
      schema: storeLegalDocumentsContentEditorSchema,
      successMessage: "Legal document draft saved."
    });

  const activeDocumentDraft = draft[activeDocument];
  const activeDocumentMeta = useMemo(
    () => DOCUMENT_TABS.find((document) => document.id === activeDocument) ?? DOCUMENT_TABS[0]!,
    [activeDocument]
  );
  const activeTemplateDefinition = useMemo(() => getStoreLegalDocument(activeDocument), [activeDocument]);
  const activeBaseTemplate = baseTemplates[activeDocument];
  const activePublishState = publishState[activeDocument];
  const activeVersions = versionHistory[activeDocument] ?? [];
  const storeName = storeContext?.name ?? "Your Store";

  const hasUnpublishedChanges = useMemo(() => {
    return (
      JSON.stringify(activeDocumentDraft.variables_json ?? {}) !== JSON.stringify(activeDocumentDraft.published_variables_json ?? {}) ||
      activeDocumentDraft.addendum_markdown.trim() !== activeDocumentDraft.published_addendum_markdown.trim()
    );
  }, [activeDocumentDraft]);

  const activePreview = useMemo(() => {
    return resolveStoreLegalDocument(
      activeDocument,
      {
        name: storeContext?.name ?? "Your Store",
        slug: storeContext?.slug ?? "your-store"
      },
      {
        support_email: storeContext?.supportEmail ?? "support@example.com"
      },
      {
        baseDocumentTitle: activeTemplateDefinition.title,
        baseBodyMarkdown: activeBaseTemplate?.bodyMarkdown ?? "",
        baseVersionLabel: activeBaseTemplate?.versionLabel ?? null,
        variables_json: activeDocumentDraft.variables_json,
        addendum_markdown: activeDocumentDraft.addendum_markdown
      }
    );
  }, [activeBaseTemplate, activeDocument, activeDocumentDraft.addendum_markdown, activeDocumentDraft.variables_json, activeTemplateDefinition.title, storeContext]);

  const activePublishedPreview = useMemo(() => {
    return resolveStoreLegalDocument(
      activeDocument,
      {
        name: storeContext?.name ?? "Your Store",
        slug: storeContext?.slug ?? "your-store"
      },
      {
        support_email: storeContext?.supportEmail ?? "support@example.com"
      },
      {
        baseDocumentTitle: activeDocumentDraft.published_title || activeTemplateDefinition.title,
        baseBodyMarkdown: activeDocumentDraft.published_body_markdown || activeBaseTemplate?.bodyMarkdown || "",
        baseVersionLabel: activeDocumentDraft.published_base_version_label || activeBaseTemplate?.versionLabel || null,
        variables_json: activeDocumentDraft.published_variables_json,
        addendum_markdown: activeDocumentDraft.published_addendum_markdown,
        publishedVersion: activeDocumentDraft.published_version,
        publishedAt: activeDocumentDraft.published_at,
        effectiveAt: activeDocumentDraft.effective_at,
        changeSummary: activeDocumentDraft.published_change_summary
      }
    );
  }, [
    activeBaseTemplate,
    activeDocument,
    activeDocumentDraft.effective_at,
    activeDocumentDraft.published_addendum_markdown,
    activeDocumentDraft.published_at,
    activeDocumentDraft.published_base_version_label,
    activeDocumentDraft.published_body_markdown,
    activeDocumentDraft.published_change_summary,
    activeDocumentDraft.published_title,
    activeDocumentDraft.published_variables_json,
    activeDocumentDraft.published_version,
    activeTemplateDefinition.title,
    storeContext
  ]);

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
      if (payload.versions) {
        setVersionHistory(payload.versions);
      }
      if (payload.baseTemplates) {
        setBaseTemplates(payload.baseTemplates);
      }
      setPublishState((current) => ({
        ...current,
        [activeDocument]: { changeSummary: "", effectiveAt: "" }
      }));
      setPublishNotice(`${activeDocumentMeta.label} published.`);
      setIsPublishDialogOpen(false);
    } catch (publishFailure) {
      setPublishError(publishFailure instanceof Error ? publishFailure.message : "Unable to publish legal document.");
    } finally {
      setPublishing(false);
    }
  }

  const actionStatusMessage = publishError ?? error ?? publishNotice;
  const actionStatusVariant = publishError || error ? "error" : publishNotice ? "info" : "error";
  const publishDisabled = saving || publishing || isDirty || !hasUnpublishedChanges || !activeBaseTemplate;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}

        {loading ? <p className="text-sm text-muted-foreground">Loading legal documents...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-border/70 pb-3">
              {DOCUMENT_TABS.map((document) => {
                const selected = document.id === activeDocument;
                return (
                  <Button
                    key={document.id}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    onClick={() => setActiveDocument(document.id)}
                    className={cn("min-w-[12rem] justify-start", !selected && "bg-background")}
                  >
                    {document.label}
                  </Button>
                );
              })}
            </div>

            <SectionCard title={activeDocumentMeta.label} description={activeDocumentMeta.description}>
              <div className="space-y-4">
                <SectionCard
                  title="Base template"
                  description="Myrivo controls the core legal language. Your store adds only approved variables and an optional addendum."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current base version</p>
                      <p className="mt-2 text-sm font-medium">{activeBaseTemplate?.versionLabel ?? "Not published yet"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activeBaseTemplate?.publishedAt
                          ? `Published ${new Date(activeBaseTemplate.publishedAt).toLocaleString("en-US")}`
                          : "Ask a platform admin to publish the base template first."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Published store version</p>
                      <p className="mt-2 text-sm font-medium">v{activeDocumentDraft.published_version}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activeDocumentDraft.published_at
                          ? `Published ${new Date(activeDocumentDraft.published_at).toLocaleString("en-US")}`
                          : "Not published yet"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Base snapshot: {activeDocumentDraft.published_base_version_label ?? "None"}
                      </p>
                    </div>
                  </div>
                  {!activeBaseTemplate ? (
                    <AppAlert
                      variant="error"
                      className="mt-4"
                      message="The admin-managed base template has not been published yet, so this document cannot be previewed or published."
                    />
                  ) : null}
                </SectionCard>

                <SectionCard title="Publication status" description="Save your changes first, then publish a new composed version for customers.">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)} disabled={!activeBaseTemplate}>
                        Preview draft
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsPublishedPreviewOpen(true)}>
                        View published
                      </Button>
                      <Button type="button" size="sm" onClick={() => setIsPublishDialogOpen(true)} disabled={publishDisabled}>
                        Publish {activeDocumentMeta.label}
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Effective</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {activeDocumentDraft.effective_at
                            ? new Date(activeDocumentDraft.effective_at).toLocaleString("en-US")
                            : "Immediate when published"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Last publish summary</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {activeDocumentDraft.published_change_summary?.trim() || "No publish summary has been recorded yet."}
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <SectionCard title="Store-specific fields" description="These values are injected into the admin-managed base template.">
                    <div className="space-y-4">
                      {activeTemplateDefinition.templateVariables.map((field) => (
                        <FormField key={field.key} label={field.label} description={field.description}>
                          <Input
                            value={activeDocumentDraft.variables_json[field.key] ?? ""}
                            onChange={(event) =>
                              setFieldValue(
                                `${activeDocument}.variables_json`,
                                {
                                  ...activeDocumentDraft.variables_json,
                                  [field.key]: event.target.value
                                }
                              )
                            }
                            placeholder={field.placeholder}
                          />
                        </FormField>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Store addendum" description={activeTemplateDefinition.addendumField.description}>
                    <FormField
                      label={activeTemplateDefinition.addendumField.label}
                      description="Optional markdown appended after the published base template."
                    >
                      <Textarea
                        rows={14}
                        value={activeDocumentDraft.addendum_markdown}
                        onChange={(event) => setFieldValue(`${activeDocument}.addendum_markdown`, event.target.value)}
                        placeholder={activeTemplateDefinition.addendumField.placeholder}
                      />
                    </FormField>
                  </SectionCard>
                </div>

                <SectionCard title="Version history" description="Published store versions preserve the exact composed policy customers saw.">
                  <StoreLegalDocumentVersionsTable versions={activeVersions} />
                </SectionCard>
              </div>
            </SectionCard>
          </form>
        ) : null}
      </div>

      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save legal settings"
        savePendingLabel="Saving legal settings..."
        savePending={saving}
        saveDisabled={!isDirty}
        discardDisabled={!isDirty}
        statusMessage={actionStatusMessage}
        statusVariant={actionStatusVariant}
      />

      <StoreLegalDocumentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title={`Preview ${activeDocumentMeta.label}`}
        description={`${activeDocumentMeta.label} draft preview`}
        storeName={storeName}
        document={activePreview}
      />

      <StoreLegalDocumentPreviewDialog
        open={isPublishedPreviewOpen}
        onOpenChange={setIsPublishedPreviewOpen}
        title={`Published ${activeDocumentMeta.label}`}
        description={`Currently published ${activeDocumentMeta.label}`}
        storeName={storeName}
        document={activePublishedPreview}
      />

      <StoreLegalDocumentPublishDialog
        open={isPublishDialogOpen}
        onOpenChange={setIsPublishDialogOpen}
        documentLabel={activeDocumentMeta.label}
        effectiveAt={activePublishState.effectiveAt}
        changeSummary={activePublishState.changeSummary}
        publishPending={publishing}
        error={publishError}
        onEffectiveAtChange={(value) =>
          setPublishState((current) => ({
            ...current,
            [activeDocument]: { ...current[activeDocument], effectiveAt: value }
          }))
        }
        onChangeSummaryChange={(value) =>
          setPublishState((current) => ({
            ...current,
            [activeDocument]: { ...current[activeDocument], changeSummary: value }
          }))
        }
        onConfirm={handlePublish}
      />
    </section>
  );
}
