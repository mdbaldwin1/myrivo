"use client";

import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AccessibilityReportFormState = {
  reporterName: string;
  reporterEmail: string;
  pageUrl: string;
  featureArea: string;
  issueSummary: string;
  expectedBehavior: string;
  actualBehavior: string;
  assistiveTechnology: string;
  browser: string;
  device: string;
  blocksCriticalFlow: boolean;
};

const INITIAL_FORM_STATE: AccessibilityReportFormState = {
  reporterName: "",
  reporterEmail: "",
  pageUrl: "",
  featureArea: "",
  issueSummary: "",
  expectedBehavior: "",
  actualBehavior: "",
  assistiveTechnology: "",
  browser: "",
  device: "",
  blocksCriticalFlow: false
};

export function AccessibilityReportForm() {
  const [formState, setFormState] = useState<AccessibilityReportFormState>(INITIAL_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const suggestedPageUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.href;
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/accessibility/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formState,
        pageUrl: formState.pageUrl.trim() || suggestedPageUrl
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "We could not submit your report right now.");
      setSaving(false);
      return;
    }

    setSuccess("Thanks. We recorded your report and queued it for support triage.");
    setFormState(INITIAL_FORM_STATE);
    setSaving(false);
  }

  return (
    <form className="space-y-4 rounded-xl border border-border/70 bg-background p-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Report an accessibility issue</h3>
        <p className="text-sm text-muted-foreground">
          If something blocked you, tell us what you were trying to do and what setup you were using. We route checkout,
          authentication, and store-management blockers as high-priority issues.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Your name" description="Optional, but helpful for follow-up.">
          <Input value={formState.reporterName} onChange={(event) => setFormState((current) => ({ ...current, reporterName: event.target.value }))} />
        </FormField>
        <FormField label="Email" description="Used only to follow up on your report." inputId="accessibility-report-email">
          <Input
            type="email"
            required
            value={formState.reporterEmail}
            onChange={(event) => setFormState((current) => ({ ...current, reporterEmail: event.target.value }))}
          />
        </FormField>
        <FormField label="Page or feature" description="Example: checkout, account sign-in, storefront product page." className="sm:col-span-2">
          <Input required value={formState.featureArea} onChange={(event) => setFormState((current) => ({ ...current, featureArea: event.target.value }))} />
        </FormField>
        <FormField label="Page URL" description="Optional if the issue maps better to a feature than a single URL." className="sm:col-span-2">
          <Input
            value={formState.pageUrl}
            placeholder={suggestedPageUrl || "https://example.com/path"}
            onChange={(event) => setFormState((current) => ({ ...current, pageUrl: event.target.value }))}
          />
        </FormField>
        <FormField label="Short summary" description="A one-line description of the barrier." className="sm:col-span-2">
          <Input
            required
            value={formState.issueSummary}
            onChange={(event) => setFormState((current) => ({ ...current, issueSummary: event.target.value }))}
          />
        </FormField>
        <FormField label="What did you expect to happen?" className="sm:col-span-2">
          <Textarea
            value={formState.expectedBehavior}
            onChange={(event) => setFormState((current) => ({ ...current, expectedBehavior: event.target.value }))}
          />
        </FormField>
        <FormField label="What happened instead?" className="sm:col-span-2">
          <Textarea
            required
            value={formState.actualBehavior}
            onChange={(event) => setFormState((current) => ({ ...current, actualBehavior: event.target.value }))}
          />
        </FormField>
        <FormField label="Assistive technology" description="Optional. Example: VoiceOver, NVDA, switch control.">
          <Input
            value={formState.assistiveTechnology}
            onChange={(event) => setFormState((current) => ({ ...current, assistiveTechnology: event.target.value }))}
          />
        </FormField>
        <FormField label="Browser" description="Optional. Example: Safari, Chrome, Firefox.">
          <Input
            value={formState.browser}
            onChange={(event) => setFormState((current) => ({ ...current, browser: event.target.value }))}
          />
        </FormField>
        <FormField label="Device" description="Optional. Example: iPhone, Windows laptop, Android tablet.">
          <Input
            value={formState.device}
            onChange={(event) => setFormState((current) => ({ ...current, device: event.target.value }))}
          />
        </FormField>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary"
          checked={formState.blocksCriticalFlow}
          onChange={(event) => setFormState((current) => ({ ...current, blocksCriticalFlow: event.target.checked }))}
        />
        <span className="space-y-1">
          <span className="block font-medium">This blocks a critical flow</span>
          <span className="block text-muted-foreground">Use this if it prevents checkout, account access, or store management.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Submitting..." : "Submit accessibility report"}
        </Button>
        <p className="text-xs text-muted-foreground">Prefer email? You can still reach us at hello@myrivo.app.</p>
      </div>

      <AppAlert variant="error" message={error} />
      <AppAlert variant="success" message={success} />
    </form>
  );
}
