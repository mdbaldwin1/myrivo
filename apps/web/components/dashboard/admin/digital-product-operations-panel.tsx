"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type HealthIssue = {
  issueType: string;
  storeId: string;
  orderId: string;
  jobId: string | null;
  status: string;
  attemptCount: number;
  ageMinutes: number;
};

export function DigitalProductOperationsPanel() {
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rolloutStoreId, setRolloutStoreId] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/platform/digital-products/operations", { cache: "no-store" });
    const payload = await response.json() as { issues?: HealthIssue[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Unable to load digital delivery health.");
    setIssues(payload.issues ?? []);
  }, []);

  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load health.")); }, [refresh]);

  async function run(action: "requeue" | "resend" | "reconcile", issue: HealthIssue) {
    const key = `${action}:${issue.orderId}`;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/platform/digital-products/operations", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ action, storeId: issue.storeId, orderId: issue.orderId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Operation failed.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function changeRollout(enabled: boolean) {
    setBusy("rollout");
    setError(null);
    try {
      const response = await fetch("/api/platform/digital-products/operations", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ action: "rollout", storeId: rolloutStoreId.trim(), enabled }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rollout change failed.");
      setRolloutStoreId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rollout change failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
    <SectionCard title="Store rollout" description="A store must also have an eligible billing plan. Missing state always remains disabled.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Store ID" placeholder="Store UUID" value={rolloutStoreId} onChange={(event) => setRolloutStoreId(event.target.value)} />
        <Button disabled={busy !== null || rolloutStoreId.trim().length === 0} onClick={() => void changeRollout(true)}>Enable</Button>
        <Button variant="outline" disabled={busy !== null || rolloutStoreId.trim().length === 0} onClick={() => void changeRollout(false)}>Disable</Button>
      </div>
    </SectionCard>
    <SectionCard title="Digital delivery health" description="Paid-order age, repeated failures, and access-state mismatches. Actions are idempotent and audited.">
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {issues.length === 0 ? <p className="text-sm text-muted-foreground">No active digital delivery alerts.</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead>Age</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{issues.map((issue) => (
            <TableRow key={`${issue.issueType}:${issue.orderId}:${issue.jobId ?? "none"}`}>
              <TableCell className="font-medium">{issue.issueType.replaceAll("_", " ")}</TableCell>
              <TableCell><span className="font-mono text-xs">{issue.orderId.slice(0, 8)}</span></TableCell>
              <TableCell><StatusChip label={`${issue.status} · ${issue.attemptCount} attempts`} tone={issue.status === "failed" ? "danger" : "warning"} /></TableCell>
              <TableCell>{issue.ageMinutes}m</TableCell>
              <TableCell><div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("requeue", issue)}>Requeue</Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("resend", issue)}>Resend</Button>
                <Button size="sm" disabled={busy !== null} onClick={() => void run("reconcile", issue)}>Reconcile</Button>
              </div></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </SectionCard>
    </div>
  );
}
