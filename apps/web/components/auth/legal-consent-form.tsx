"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type LegalConsentFormProps = {
  returnTo: string;
  versions: Array<{ id: string; title: string; key: string; versionLabel: string }>;
};

export function LegalConsentForm({ returnTo, versions }: LegalConsentFormProps) {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const versionIds = useMemo(() => versions.map((version) => version.id), [versions]);

  async function submitConsent() {
    setError(null);
    if (!accepted) {
      setError("You must accept the updated legal terms to continue.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionIds, returnTo })
    });

    const payload = (await response.json()) as { ok?: boolean; returnTo?: string; error?: string };
    setSubmitting(false);
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to record legal consent.");
      return;
    }

    router.push(payload.returnTo ?? returnTo);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>I have read and accept the required legal updates listed above.</span>
        </label>
      </div>
      <FeedbackMessage type="error" message={error} />
      <Button type="button" disabled={submitting || !accepted} onClick={() => void submitConsent()}>
        {submitting ? "Saving..." : "Accept and continue"}
      </Button>
    </div>
  );
}
