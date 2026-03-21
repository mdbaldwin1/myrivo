"use client";

import { useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";

type StoreTaxCollectionMode = "unconfigured" | "stripe_tax" | "seller_attested_no_tax";

type StorePaymentsTaxDecisionProps = {
  storeSlug: string | null;
  connected: boolean;
  taxCollectionMode: StoreTaxCollectionMode;
  taxComplianceAcknowledgedAt?: string | null;
  taxComplianceNote?: string | null;
  onStatusRefresh: () => Promise<void>;
};

type TaxDecisionResponse = {
  taxCollectionMode: StoreTaxCollectionMode;
  taxComplianceAcknowledgedAt: string | null;
  taxComplianceNote: string | null;
  error?: string;
};

export function StorePaymentsTaxDecision({
  storeSlug,
  connected,
  taxCollectionMode,
  taxComplianceAcknowledgedAt,
  taxComplianceNote,
  onStatusRefresh
}: StorePaymentsTaxDecisionProps) {
  const [selectedMode, setSelectedMode] = useState<StoreTaxCollectionMode>(taxCollectionMode);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState(taxComplianceNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function readJsonSafe<T>(response: Response): Promise<T | null> {
    try {
      const text = await response.text();
      if (!text) {
        return null;
      }

      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function saveDecision() {
    setPending(true);
    setError(null);
    setMessage(null);

    const body =
      selectedMode === "seller_attested_no_tax"
        ? {
            mode: "seller_attested_no_tax" as const,
            acknowledged: true as const,
            note: note.trim() || undefined
          }
        : {
            mode: "stripe_tax" as const
          };

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/tax-decision", storeSlug), {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = await readJsonSafe<TaxDecisionResponse>(response);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to save tax handling choice.");
      setPending(false);
      return;
    }

    await onStatusRefresh();
    setAcknowledged(false);
    setMessage(selectedMode === "stripe_tax" ? "Tax handling set to Stripe Tax." : "No-tax attestation saved.");
    setPending(false);
  }

  async function clearDecision() {
    const confirmed = window.confirm("Clear this store's saved tax decision? This will put tax handling back into an unconfigured state.");
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/payments/tax-decision", storeSlug), {
      method: "DELETE"
    });

    const payload = await readJsonSafe<TaxDecisionResponse>(response);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to clear tax handling choice.");
      setPending(false);
      return;
    }

    setSelectedMode("unconfigured");
    setAcknowledged(false);
    setNote("");
    await onStatusRefresh();
    setMessage("Tax decision cleared.");
    setPending(false);
  }

  const selectedStripeTax = selectedMode === "stripe_tax";
  const selectedNoTax = selectedMode === "seller_attested_no_tax";
  const isDirty = selectedMode !== taxCollectionMode || (selectedNoTax && note !== (taxComplianceNote ?? ""));
  const canSave = selectedStripeTax ? isDirty : selectedNoTax && acknowledged && isDirty;

  const currentStatusMessage =
    taxCollectionMode === "stripe_tax"
      ? "This store is configured to collect tax through Stripe Tax."
      : taxCollectionMode === "seller_attested_no_tax"
        ? "This store is using a seller-attested no-tax path. Keep the acknowledgement and note up to date."
        : "Choose how this store will handle tax before launch.";

  return (
    <div className="space-y-3">
      <AppAlert
        variant={taxCollectionMode === "unconfigured" ? "warning" : "info"}
        message={currentStatusMessage}
      />

      <div className="space-y-3">
        <button
          type="button"
          className={`w-full rounded-lg border p-4 text-left transition ${selectedStripeTax ? "border-foreground bg-muted/30" : "border-border/70 hover:border-border"}`}
          onClick={() => {
            setSelectedMode("stripe_tax");
            setError(null);
            setMessage(null);
          }}
        >
          <p className="text-sm font-medium">Set up tax collection with Stripe Tax</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use Stripe Tax settings and registrations for the connected seller account. This is the safer default path.
          </p>
          {!connected ? <p className="mt-2 text-xs text-amber-700">Connect Stripe to finish this setup path.</p> : null}
        </button>

        <button
          type="button"
          className={`w-full rounded-lg border p-4 text-left transition ${selectedNoTax ? "border-foreground bg-muted/30" : "border-border/70 hover:border-border"}`}
          onClick={() => {
            setSelectedMode("seller_attested_no_tax");
            setError(null);
            setMessage(null);
          }}
        >
          <p className="text-sm font-medium">Sell without tax collection for now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Record an explicit seller acknowledgement that Myrivo does not provide tax advice or determine whether this store is exempt from tax obligations.
          </p>
        </button>
      </div>

      {selectedNoTax ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
          <AppAlert
            variant="warning"
            message="Myrivo does not provide tax advice or decide whether this business is exempt from tax obligations. You are responsible for determining whether this business must register, collect, remit, and file taxes for its sales."
          />
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>I understand that I am responsible for tax compliance for this business.</span>
          </label>
          <div className="space-y-1">
            <p className="text-sm font-medium">Optional note</p>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add context for why this store is selling without tax collection for now."
              rows={4}
            />
          </div>
          {taxComplianceAcknowledgedAt ? (
            <p className="text-xs text-muted-foreground">Last acknowledged: {new Date(taxComplianceAcknowledgedAt).toLocaleString()}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void saveDecision()} disabled={pending || !canSave}>
          {pending ? "Saving..." : "Save tax decision"}
        </Button>
        {taxCollectionMode !== "unconfigured" ? (
          <Button type="button" variant="destructive" onClick={() => void clearDecision()} disabled={pending}>
            {pending ? "Clearing..." : "Clear tax decision"}
          </Button>
        ) : null}
      </div>

      <FeedbackMessage type="success" message={message} />
      <FeedbackMessage type="error" message={error} />
    </div>
  );
}
