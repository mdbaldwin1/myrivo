import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardAlert } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type PriorityAlertsPanelProps = {
  alerts: StoreDashboardAlert[];
};

function toneClass(severity: StoreDashboardAlert["severity"]) {
  if (severity === "critical") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }
  if (severity === "high") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-sky-300 bg-sky-50 text-sky-700";
}

export function PriorityAlertsPanel({ alerts }: PriorityAlertsPanelProps) {
  return (
    <SectionCard title="Priority Alerts" description="Blockers and high-impact issues that need immediate attention.">
      <ul className="space-y-2 text-sm">
        {alerts.length === 0 ? (
          <li className="text-muted-foreground">No priority alerts.</li>
        ) : (
          alerts.map((alert) => (
            <li key={alert.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{alert.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${toneClass(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
              <Link href={alert.actionHref} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                {alert.actionLabel}
              </Link>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}
