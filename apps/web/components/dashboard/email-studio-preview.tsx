"use client";

import { Monitor, Smartphone } from "lucide-react";
import {
  emailStudioPreviewScenarios,
  renderEmailStudioPreview,
  resolveEmailStudioPreviewScenario,
  type EmailStudioPreviewScenarioId
} from "@/lib/email-studio/preview";
import type { EmailStudioTemplateDocument, EmailStudioTemplateId, EmailStudioThemeDocument } from "@/lib/email-studio/model";
import { cn } from "@/lib/utils";

type EmailStudioPreviewProps = {
  templateId: EmailStudioTemplateId;
  template: EmailStudioTemplateDocument;
  theme: EmailStudioThemeDocument;
  senderName: string;
  replyToEmail: string;
  storeName: string;
  scenarioId: EmailStudioPreviewScenarioId;
  viewport: "desktop" | "mobile";
  onScenarioChange: (scenarioId: EmailStudioPreviewScenarioId) => void;
  onViewportChange: (viewport: "desktop" | "mobile") => void;
};

export function EmailStudioPreview({
  templateId,
  template,
  theme,
  senderName,
  replyToEmail,
  storeName,
  scenarioId,
  viewport,
  onScenarioChange,
  onViewportChange
}: EmailStudioPreviewProps) {
  const scenario = resolveEmailStudioPreviewScenario(templateId, scenarioId);
  const preview = renderEmailStudioPreview(template, scenario.values, theme, senderName, replyToEmail, storeName);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Preview</p>
            <p className="text-xs text-muted-foreground">Rendered with sample order data so tokens resolve immediately.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              {emailStudioPreviewScenarios.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onScenarioChange(entry.id)}
                  className={cn(
                    "rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                    scenario.id === entry.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => onViewportChange("desktop")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                  viewport === "desktop" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => onViewportChange("mobile")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                  viewport === "mobile" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.9))] p-4 shadow-sm">
        <div
          className={cn(
            "overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]",
            viewport === "desktop" ? "w-full max-w-[54rem]" : "w-full max-w-[24rem]"
          )}
        >
          <div className="border-b border-border/70 bg-slate-50 px-4 py-3">
            <div className="space-y-1 text-sm">
              <p><span className="font-medium text-muted-foreground">From:</span> {preview.from}</p>
              <p><span className="font-medium text-muted-foreground">To:</span> {preview.to}</p>
              <p><span className="font-medium text-muted-foreground">Reply-to:</span> {preview.replyTo || "Fallback reply-to"}</p>
              <p><span className="font-medium text-muted-foreground">Subject:</span> {preview.subject}</p>
              <p><span className="font-medium text-muted-foreground">Preheader:</span> {preview.preheader || "None"}</p>
            </div>
          </div>
          <div className="border-b border-border/70 bg-white px-3 py-3">
            <div
              className={cn("overflow-hidden rounded-[1rem] border border-border/70", viewport === "desktop" ? "min-h-[520px]" : "min-h-[640px]")}
            >
              <iframe title="Rendered email preview" srcDoc={preview.html} className="h-[520px] w-full bg-white md:h-[640px]" />
            </div>
          </div>
          <div className="space-y-4 px-5 py-5 text-sm leading-6 text-slate-700">
            {preview.body.split("\n").map((line, index) =>
              line.trim().length > 0 ? (
                <p key={`${index}-${line}`}>{line}</p>
              ) : (
                <div key={`spacer-${index}`} className="h-2" aria-hidden />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
