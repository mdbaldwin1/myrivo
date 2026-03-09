import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type ActivityTimelinePanelProps = {
  timeline: StoreDashboardData["timeline"];
  errorMessage?: string;
  retryHref: string;
};

function kindLabel(kind: StoreDashboardData["timeline"][number]["kind"]) {
  if (kind === "order") return "Order";
  if (kind === "inventory") return "Inventory";
  if (kind === "billing") return "Billing";
  if (kind === "domain") return "Domain";
  return "Settings";
}

export function ActivityTimelinePanel({ timeline, errorMessage, retryHref }: ActivityTimelinePanelProps) {
  return (
    <SectionCard title="Activity Timeline" description="Recent operational events across orders, inventory, billing, settings, and domains.">
      <AppAlert
        variant="warning"
        message={errorMessage ?? null}
        action={
          <Link href={retryHref} className="text-xs font-medium underline">
            Retry
          </Link>
        }
      />
      <ul className="space-y-2 text-sm">
        {timeline.length === 0 ? (
          <li className="text-muted-foreground">No activity yet.</li>
        ) : (
          timeline.map((event) => (
            <li key={event.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-medium">{event.title}</p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase text-muted-foreground">{kindLabel(event.kind)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{event.detail}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()}</p>
                {event.href ? (
                  <Link href={event.href} className="text-xs font-medium text-primary hover:underline">
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}
