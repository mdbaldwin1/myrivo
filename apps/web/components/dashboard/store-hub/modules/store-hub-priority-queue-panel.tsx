import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubPriorityItem } from "@/lib/dashboard/store-hub/store-hub-types";

function severityTone(severity: StoreHubPriorityItem["severity"]) {
  if (severity === "critical") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }
  if (severity === "high") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-sky-300 bg-sky-50 text-sky-700";
}

type StoreHubPriorityQueuePanelProps = {
  items: StoreHubPriorityItem[];
};

export function StoreHubPriorityQueuePanel({ items }: StoreHubPriorityQueuePanelProps) {
  return (
    <SectionCard title="Priority Queue" description="Cross-store blockers and high-impact tasks needing immediate action.">
      <ul className="space-y-2 text-sm">
        {items.length === 0 ? (
          <li className="text-muted-foreground">No critical or high-priority items.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.storeName}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${severityTone(item.severity)}`}>
                  {item.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              <Link href={item.href} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                Open task
              </Link>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}
