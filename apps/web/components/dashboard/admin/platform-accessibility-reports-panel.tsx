"use client";

import { useEffect, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCESSIBILITY_REPORT_PRIORITIES,
  ACCESSIBILITY_REPORT_PRIORITY_LABELS,
  ACCESSIBILITY_REPORT_STATUSES,
  ACCESSIBILITY_REPORT_STATUS_LABELS,
  type AccessibilityReportPriority,
  type AccessibilityReportRecord,
  type AccessibilityReportStatus
} from "@/lib/accessibility-reports";

type PlatformAccessibilityReportsResponse = {
  role: "user" | "support" | "admin";
  summary: {
    totalCount: number;
    openCount: number;
    criticalOpenCount: number;
  };
  reports: AccessibilityReportRecord[];
  error?: string;
};

export function PlatformAccessibilityReportsPanel() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformAccessibilityReportsResponse | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, { ownerNotes: string; remediationNotes: string }>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/accessibility/reports", { cache: "no-store" });
      const payload = (await response.json()) as PlatformAccessibilityReportsResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load accessibility reports.");
        setLoading(false);
        return;
      }
      setData(payload);
      setDraftNotes(
        Object.fromEntries(
          (payload.reports ?? []).map((report) => [
            report.id,
            {
              ownerNotes: report.owner_notes ?? "",
              remediationNotes: report.remediation_notes ?? ""
            }
          ])
        )
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateReport(report: AccessibilityReportRecord, updates: { status?: AccessibilityReportStatus; priority?: AccessibilityReportPriority }) {
    setSavingId(report.id);
    setError(null);
    const noteDraft = draftNotes[report.id] ?? {
      ownerNotes: report.owner_notes ?? "",
      remediationNotes: report.remediation_notes ?? ""
    };
    const response = await fetch("/api/platform/accessibility/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: report.id,
        status: updates.status ?? report.status,
        priority: updates.priority ?? report.priority,
        ownerNotes: noteDraft.ownerNotes,
        remediationNotes: noteDraft.remediationNotes
      })
    });
    const payload = (await response.json()) as { report?: AccessibilityReportRecord; error?: string };
    if (!response.ok || !payload.report) {
      setError(payload.error ?? "Unable to update accessibility report.");
      setSavingId(null);
      return;
    }
    const updatedReport = payload.report;
    setData((current) =>
      current
        ? {
            ...current,
            reports: current.reports.map((entry) => (entry.id === updatedReport.id ? updatedReport : entry)),
            summary: {
              totalCount: current.summary.totalCount,
              openCount: current.reports.reduce((count, entry) => {
                const next = entry.id === updatedReport.id ? updatedReport : entry;
                return count + (["new", "triaged", "in_progress"].includes(next.status) ? 1 : 0);
              }, 0),
              criticalOpenCount: current.reports.reduce((count, entry) => {
                const next = entry.id === updatedReport.id ? updatedReport : entry;
                return count + (next.priority === "critical" && ["new", "triaged", "in_progress"].includes(next.status) ? 1 : 0);
              }, 0)
            }
          }
        : current
    );
    setDraftNotes((current) => ({
      ...current,
      [updatedReport.id]: {
        ownerNotes: updatedReport.owner_notes ?? "",
        remediationNotes: updatedReport.remediation_notes ?? ""
      }
    }));
    setSavingId(null);
  }

  return (
    <SectionCard title="Accessibility Reports" description="Public accessibility issues waiting for triage or remediation.">
      {loading ? <p className="text-sm text-muted-foreground">Loading accessibility queue...</p> : null}
      {data ? (
        <div className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Total reports</p>
              <p className="text-muted-foreground">{data.summary.totalCount}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Open</p>
              <p className="text-muted-foreground">{data.summary.openCount}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Critical open</p>
              <p className="text-muted-foreground">{data.summary.criticalOpenCount}</p>
            </div>
          </div>

          <div className="space-y-2">
            {data.reports.map((report) => (
              <div key={report.id} className="space-y-3 rounded-md border border-border/70 bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{report.issue_summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.feature_area} · {report.reporter_email} · {new Date(report.created_at).toLocaleString()}
                    </p>
                    {report.page_url ? <p className="break-all text-xs text-muted-foreground">{report.page_url}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
                      value={report.priority}
                      disabled={savingId === report.id}
                      onChange={(event) => void updateReport(report, { priority: event.target.value as AccessibilityReportPriority })}
                    >
                      {ACCESSIBILITY_REPORT_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {ACCESSIBILITY_REPORT_PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
                      value={report.status}
                      disabled={savingId === report.id}
                      onChange={(event) => void updateReport(report, { status: event.target.value as AccessibilityReportStatus })}
                    >
                      {ACCESSIBILITY_REPORT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ACCESSIBILITY_REPORT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    {report.status !== "resolved" && report.status !== "dismissed" ? (
                      <Button type="button" size="sm" variant="outline" disabled={savingId === report.id} onClick={() => void updateReport(report, { status: "in_progress" })}>
                        Start work
                      </Button>
                    ) : null}
                    {report.status !== "resolved" ? (
                      <Button type="button" size="sm" disabled={savingId === report.id} onClick={() => void updateReport(report, { status: "resolved" })}>
                        Mark resolved
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What happened</p>
                    <p className="text-sm text-muted-foreground">{report.actual_behavior}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected behavior</p>
                    <p className="text-sm text-muted-foreground">{report.expected_behavior || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</p>
                    <p className="text-sm text-muted-foreground">
                      {(report.assistive_technology || "No assistive technology listed") +
                        " · " +
                        (report.browser || "Browser not listed") +
                        " · " +
                        (report.device || "Device not listed")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Severity</p>
                    <p className="text-sm text-muted-foreground">
                      {ACCESSIBILITY_REPORT_PRIORITY_LABELS[report.priority]}
                      {report.blocks_critical_flow ? " · Blocks a critical flow" : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner notes</p>
                    <Textarea
                      value={draftNotes[report.id]?.ownerNotes ?? ""}
                      onChange={(event) =>
                        setDraftNotes((current) => ({
                          ...current,
                          [report.id]: {
                            ownerNotes: event.target.value,
                            remediationNotes: current[report.id]?.remediationNotes ?? report.remediation_notes ?? ""
                          }
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remediation notes</p>
                    <Textarea
                      value={draftNotes[report.id]?.remediationNotes ?? ""}
                      onChange={(event) =>
                        setDraftNotes((current) => ({
                          ...current,
                          [report.id]: {
                            ownerNotes: current[report.id]?.ownerNotes ?? report.owner_notes ?? "",
                            remediationNotes: event.target.value
                          }
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" disabled={savingId === report.id} onClick={() => void updateReport(report, {})}>
                    Save notes
                  </Button>
                </div>
              </div>
            ))}
            {data.reports.length === 0 ? <p className="text-muted-foreground">No accessibility reports yet.</p> : null}
          </div>
        </div>
      ) : null}
      <AppAlert variant="error" message={error} className="mt-2" />
    </SectionCard>
  );
}
