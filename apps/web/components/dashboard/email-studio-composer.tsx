"use client";

import { Mail, Reply, Send, Sparkles } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { EmailStudioDocument, EmailStudioTemplateDocument } from "@/lib/email-studio/model";

type EmailStudioComposerField = "subject" | "preheader" | "headline" | "bodyHtml" | "ctaLabel" | "ctaUrl" | "footerNote";

type EmailStudioComposerProps = {
  storeName: string;
  document: EmailStudioDocument;
  template: EmailStudioTemplateDocument;
  activeField: EmailStudioComposerField;
  onDocumentChange: (value: EmailStudioDocument) => void;
  onFieldFocus: (field: EmailStudioComposerField) => void;
};

function updateActiveTemplate(document: EmailStudioDocument, template: EmailStudioTemplateDocument) {
  return {
    ...document,
    templates: {
      ...document.templates,
      [template.id]: template
    }
  };
}

export function EmailStudioComposer({ storeName, document, template, activeField, onDocumentChange, onFieldFocus }: EmailStudioComposerProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              Audience: {template.audience === "customer" ? "Customer" : "Store owner"}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              From: {(document.senderName || storeName).trim() || "Your store"}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
              <Reply className="h-3.5 w-3.5" />
              Reply-to: {document.replyToEmail.trim() || "support email fallback"}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FormField label="Sender name" description="Shown in the inbox sender line. Falls back to the store name if blank.">
              <Input
                value={document.senderName}
                onChange={(event) => onDocumentChange({ ...document, senderName: event.target.value })}
                placeholder={storeName || "Your store"}
              />
            </FormField>
            <FormField label="Reply-to email" description="Used for customer replies. Falls back to support email and platform defaults if blank.">
              <Input
                type="email"
                value={document.replyToEmail}
                onChange={(event) => onDocumentChange({ ...document, replyToEmail: event.target.value })}
                placeholder="support@yourdomain.com"
              />
            </FormField>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{template.label}</p>
          <p className="text-xs text-muted-foreground">{template.description}</p>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Subject">
              <Input
                value={template.subject}
                onFocus={() => onFieldFocus("subject")}
                onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, subject: event.target.value }))}
                placeholder="Write the subject line"
                className={activeField === "subject" ? "ring-2 ring-primary/20" : undefined}
              />
            </FormField>
            <FormField label="Preheader" description="Shown in supporting inbox preview text.">
              <Input
                value={template.preheader}
                onFocus={() => onFieldFocus("preheader")}
                onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, preheader: event.target.value }))}
                placeholder="Short preview text that follows the subject"
                className={activeField === "preheader" ? "ring-2 ring-primary/20" : undefined}
              />
            </FormField>
          </div>

          <FormField label="Headline" description="The main heading inside the email card.">
            <Input
              value={template.headline}
              onFocus={() => onFieldFocus("headline")}
              onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, headline: event.target.value }))}
              placeholder="Main email headline"
              className={activeField === "headline" ? "ring-2 ring-primary/20" : undefined}
            />
          </FormField>

          <FormField
            label="Email body"
            description="Rich content with lists, links, emphasis, and tokens. This renders as HTML in the delivered email."
          >
            <div onFocusCapture={() => onFieldFocus("bodyHtml")}>
              <RichTextEditor
                value={template.bodyHtml}
                onChange={(nextValue) => onDocumentChange(updateActiveTemplate(document, { ...template, bodyHtml: nextValue }))}
                placeholder="Write the main email content"
                rows={12}
                imageUpload={{ folder: "email-studio" }}
              />
            </div>
          </FormField>

          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Call to action</p>
                <p className="text-xs text-muted-foreground">Use this for the main button. Leave both fields blank to hide it.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FormField label="Button label">
                <Input
                  value={template.ctaLabel}
                  onFocus={() => onFieldFocus("ctaLabel")}
                  onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, ctaLabel: event.target.value }))}
                  placeholder="View order"
                  className={activeField === "ctaLabel" ? "ring-2 ring-primary/20" : undefined}
                />
              </FormField>
              <FormField label="Button URL" description="Supports tokens like {orderUrl} and {dashboardUrl}.">
                <Input
                  value={template.ctaUrl}
                  onFocus={() => onFieldFocus("ctaUrl")}
                  onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, ctaUrl: event.target.value }))}
                  placeholder="{orderUrl}"
                  className={activeField === "ctaUrl" ? "ring-2 ring-primary/20" : undefined}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Footer note" description="Usually support, reply, or reassurance copy below the button.">
            <Input
              value={template.footerNote}
              onFocus={() => onFieldFocus("footerNote")}
              onChange={(event) => onDocumentChange(updateActiveTemplate(document, { ...template, footerNote: event.target.value }))}
              placeholder="Questions? Contact {replyToEmail}."
              className={activeField === "footerNote" ? "ring-2 ring-primary/20" : undefined}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
