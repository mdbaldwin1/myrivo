"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import { EmailStudioComposer } from "@/components/dashboard/email-studio-composer";
import { EmailStudioPreview } from "@/components/dashboard/email-studio-preview";
import { EmailStudioSidePanel } from "@/components/dashboard/email-studio-side-panel";
import { EmailStudioTokenList } from "@/components/dashboard/email-studio-token-list";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { useLocalStorageFlag, writeLocalStorageFlag } from "@/components/dashboard/use-local-storage-flag";
import { Button } from "@/components/ui/button";
import { useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";
import {
  createEmailStudioDocumentFromSection,
  serializeEmailStudioDocument,
  type EmailStudioTemplateDocument,
  type EmailStudioTemplateId
} from "@/lib/email-studio/model";
import type { EmailStudioPreviewScenarioId } from "@/lib/email-studio/preview";

type EmailStudioProps = {
  storeName?: string | null;
};

const DASHBOARD_SIDEBAR_STORAGE_KEY = "myrivo.dashboard-sidebar-collapsed";
const EMAIL_STUDIO_RAIL_STORAGE_KEY = "myrivo.email-studio-rail-collapsed";

export function EmailStudio({ storeName }: EmailStudioProps) {
  const formId = "email-studio-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("emails");
  const [activeTemplateId, setActiveTemplateId] = useState<EmailStudioTemplateId>("customerConfirmation");
  const [activeField, setActiveField] = useState<"subject" | "preheader" | "headline" | "bodyHtml" | "ctaLabel" | "ctaUrl" | "footerNote">("bodyHtml");
  const [previewScenario, setPreviewScenario] = useState<EmailStudioPreviewScenarioId>("pickup");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const railCollapsed = useLocalStorageFlag(EMAIL_STUDIO_RAIL_STORAGE_KEY);
  const document = useMemo(
    () => createEmailStudioDocumentFromSection(draft, storeName),
    [draft, storeName]
  );
  const activeTemplate = document.templates[activeTemplateId];

  useEffect(() => {
    writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, true);
  }, []);

  function updateDocument(mutator: (current: typeof document) => typeof document) {
    setDraft((current) => {
      const nextDocument = mutator(createEmailStudioDocumentFromSection(current, storeName));
      return {
        ...current,
        ...serializeEmailStudioDocument(nextDocument)
      };
    });
  }

  function updateActiveTemplate(mutator: (template: EmailStudioTemplateDocument) => EmailStudioTemplateDocument) {
    updateDocument((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [activeTemplateId]: mutator(current.templates[activeTemplateId])
      }
    }));
  }

  function insertToken(token: string) {
    updateActiveTemplate((template) => {
      if (activeField === "bodyHtml") {
        const nextBodyHtml = `${template.bodyHtml}${template.bodyHtml.trim().length > 0 ? "" : ""}<p>${token}</p>`;
        return { ...template, bodyHtml: nextBodyHtml };
      }

      return {
        ...template,
        [activeField]: `${template[activeField]}${token}`
      };
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <DashboardPageHeader
        title="Email Studio"
        description="Compose transactional lifecycle emails in a dedicated workspace instead of mixing them into the storefront builder."
        action={
          <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
        }
      />

      {loading ? <p className="px-1 text-sm text-muted-foreground">Loading transactional email templates...</p> : null}

      {!loading ? (
        <form
          id={formId}
          className="flex min-h-0 flex-1 flex-col"
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
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 xl:flex-row">
              <EmailStudioSidePanel
                document={document}
                activeTemplateId={activeTemplateId}
                collapsed={railCollapsed}
                onSelectTemplate={setActiveTemplateId}
                onCollapsedChange={(collapsed) => writeLocalStorageFlag(EMAIL_STUDIO_RAIL_STORAGE_KEY, collapsed)}
                onDocumentChange={(value) => updateDocument(() => value)}
              />

              <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
                <div className="min-h-0 space-y-4 overflow-y-auto pb-4">
                  <EmailStudioComposer
                    storeName={storeName?.trim() || "Your store"}
                    document={document}
                    template={activeTemplate}
                    activeField={activeField}
                    onDocumentChange={(value) => updateDocument(() => value)}
                    onFieldFocus={setActiveField}
                  />
                  <EmailStudioTokenList onInsertToken={insertToken} />
                </div>

                <DashboardFormActionBar
                  formId={formId}
                  className="rounded-2xl border border-border/70 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:px-4"
                  saveLabel="Save templates"
                  savePendingLabel="Saving..."
                  discardLabel="Discard"
                  savePending={saving}
                  saveDisabled={!isDirty || saving}
                  discardDisabled={!isDirty || saving}
                  statusMessage={error}
                  statusVariant="error"
                />
              </div>
            </div>
          </div>
        </form>
      ) : null}

      <DialogPrimitive.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <DialogPrimitive.Content className="fixed inset-3 z-[71] overflow-hidden rounded-2xl border border-border/70 bg-stone-50 shadow-[0_30px_80px_rgba(15,23,42,0.28)] data-[state=open]:animate-in data-[state=closed]:animate-out">
            <DialogPrimitive.Title className="sr-only">Email preview</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Preview the current transactional email with sample data and viewport controls.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close email preview"
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/95 text-foreground shadow-sm backdrop-blur transition hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
            <div className="h-full overflow-y-auto p-3">
              <EmailStudioPreview
                templateId={activeTemplateId}
                template={activeTemplate}
                theme={document.theme}
                senderName={document.senderName}
                replyToEmail={document.replyToEmail}
                storeName={storeName?.trim() || "Your store"}
                scenarioId={previewScenario}
                viewport={previewViewport}
                onScenarioChange={setPreviewScenario}
                onViewportChange={setPreviewViewport}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
}
