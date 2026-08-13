"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

type AttemptSummary = {
  attemptNumber: number;
  status: "processing" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
};

export type DigitalOrderDeliverySummary = {
  fileCount: number;
  deliveryStatus: "pending" | "processing" | "succeeded" | "failed";
  initialDeliveryEmailStatus: "pending" | "processing" | "succeeded" | "failed" | "not_queued";
  accessStatus: "active" | "suspended" | "revoked" | "expired" | "pending";
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  attempts: AttemptSummary[];
  initialDeliveryEmailAttempts: AttemptSummary[];
  files: Array<{
    label: string;
    filename: string;
    format: string;
    grantsRemaining: number | null;
    status: "active" | "suspended" | "revoked" | "pending";
  }>;
  activeLinkExpiresAt: string | null;
  activeDisputeStatus: string | null;
};

function statusTone(status: string) {
  if (status === "succeeded" || status === "active") return "success" as const;
  if (status === "failed" || status === "revoked" || status === "expired") return "danger" as const;
  if (status === "processing") return "info" as const;
  return "warning" as const;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

export function DigitalOrderDeliveryPanel({
  orderId,
  summary,
  onQueued
}: {
  orderId: string;
  summary: DigitalOrderDeliverySummary;
  onQueued?: () => void;
}) {
  const requestKeyRef = useRef<string | null>(null);
  if (!requestKeyRef.current) {
    requestKeyRef.current = crypto.randomUUID();
  }
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function resend() {
    setSending(true);
    setFeedback(null);
    const requestKey = requestKeyRef.current ?? crypto.randomUUID();
    requestKeyRef.current = requestKey;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/digital-delivery/resend`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        credentials: "same-origin"
      });
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Unable to queue a fresh link.");
      }
      requestKeyRef.current = crypto.randomUUID();
      setFeedback({ kind: "success", message: "Fresh access link queued. Download grants are unchanged." });
      onQueued?.();
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Unable to queue a fresh link." });
    } finally {
      setSending(false);
    }
  }

  const deliveryLabel = summary.deliveryStatus === "failed"
    ? "Delivery needs attention"
    : `Delivery ${formatStatus(summary.deliveryStatus).toLowerCase()}`;
  const initialDeliveryEmailLabel = summary.initialDeliveryEmailStatus === "failed"
    ? "Initial email needs attention"
    : summary.initialDeliveryEmailStatus === "not_queued"
      ? "Initial email not queued"
      : `Initial email ${formatStatus(summary.initialDeliveryEmailStatus).toLowerCase()}`;
  const accessLabel = summary.activeDisputeStatus && summary.accessStatus === "suspended"
    ? "Downloads suspended during the open dispute"
    : summary.accessStatus === "expired"
      ? "Access link expired — files remain eligible for a fresh link"
      : `Access ${summary.accessStatus}`;
  const resendUnavailableReason = summary.deliveryStatus !== "succeeded"
    ? "Complete the initial delivery before sending a fresh link."
    : summary.initialDeliveryEmailStatus !== "succeeded"
      ? "The initial delivery email must be sent before sending a fresh link."
      : summary.activeDisputeStatus || summary.accessStatus === "suspended"
        ? "Downloads are suspended and cannot receive a fresh link."
        : summary.accessStatus === "revoked"
          ? "Downloads were revoked and cannot receive a fresh link."
          : summary.accessStatus === "pending"
            ? "Download access is not ready for a fresh link."
            : null;

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-background p-4" aria-labelledby="digital-delivery-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="digital-delivery-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Digital delivery</h3>
          <p className="mt-1 font-medium">{summary.fileCount} manifest {summary.fileCount === 1 ? "file" : "files"}</p>
        </div>
        <div className="max-w-sm space-y-1 sm:text-right">
          <Button type="button" size="sm" variant="outline" disabled={sending || Boolean(resendUnavailableReason)} aria-describedby={resendUnavailableReason ? "digital-resend-unavailable" : undefined} onClick={() => void resend()}>
            {sending ? "Queueing…" : feedback?.kind === "error" ? "Try sending again" : "Send fresh access link"}
          </Button>
          {resendUnavailableReason ? <p id="digital-resend-unavailable" className="text-xs text-muted-foreground">{resendUnavailableReason}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusChip label={deliveryLabel} tone={statusTone(summary.deliveryStatus)} />
        <StatusChip label={initialDeliveryEmailLabel} tone={statusTone(summary.initialDeliveryEmailStatus)} />
        <StatusChip label={accessLabel} tone={statusTone(summary.accessStatus)} />
      </div>

      {feedback ? (
        <p role={feedback.kind === "error" ? "alert" : "status"} className={feedback.kind === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}>
          {feedback.message}
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">First access</dt><dd>{summary.firstAccessedAt ? new Date(summary.firstAccessedAt).toLocaleString() : "Not accessed"}</dd></div>
        <div><dt className="text-muted-foreground">Latest access</dt><dd>{summary.lastAccessedAt ? new Date(summary.lastAccessedAt).toLocaleString() : "Not accessed"}</dd></div>
        <div><dt className="text-muted-foreground">Current link</dt><dd>{summary.activeLinkExpiresAt ? `Expires ${new Date(summary.activeLinkExpiresAt).toLocaleString()}` : "No active link"}</dd></div>
      </dl>

      <div>
        <h4 className="font-medium">Purchased files</h4>
        <ul className="mt-2 space-y-2">
          {summary.files.map((file, index) => (
            <li key={`${file.filename}:${index}`} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium">{file.label}</p><p className="text-xs text-muted-foreground">{file.filename} · {file.format}</p></div>
                <p>{file.grantsRemaining === null ? "Grants available after delivery" : `${file.grantsRemaining} of 5 grants remaining`}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {summary.attempts.length > 0 || summary.initialDeliveryEmailAttempts.length > 0 ? (
        <div>
          <h4 className="font-medium">Attempt history</h4>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {summary.attempts.map((attempt) => <li key={`delivery:${attempt.attemptNumber}`}>Attempt {attempt.attemptNumber} · {formatStatus(attempt.status)}</li>)}
            {summary.initialDeliveryEmailAttempts.map((attempt) => <li key={`email:${attempt.attemptNumber}`}>Initial email attempt {attempt.attemptNumber} · {formatStatus(attempt.status)}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
