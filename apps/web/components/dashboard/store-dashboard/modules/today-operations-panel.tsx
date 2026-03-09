import Link from "next/link";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData, StoreDashboardNextTask } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type TodayOperationsPanelProps = {
  operations: StoreDashboardData["operations"];
};

function priorityClass(priority: StoreDashboardNextTask["priority"]) {
  if (priority === "critical") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }
  if (priority === "high") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-sky-300 bg-sky-50 text-sky-700";
}

export function TodayOperationsPanel({ operations }: TodayOperationsPanelProps) {
  return (
    <SectionCard title="Today Operations" description="Current fulfillment workload and immediate action queue.">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <DataStat label="Pending Fulfillment" value={String(operations.pendingFulfillment)} className="bg-card" />
          <DataStat label="Packing" value={String(operations.packing)} className="bg-card" />
          <DataStat label="Overdue" value={String(operations.overdueFulfillment)} className="bg-card" />
          <DataStat label="Shipping Exceptions" value={String(operations.shippingExceptions)} className="bg-card" />
          <DataStat label="Pickup Due (4h)" value={String(operations.duePickupWindows)} className="bg-card" />
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next Tasks</h3>
          <ul className="space-y-2 text-sm">
            {operations.nextTasks.length === 0 ? (
              <li className="text-muted-foreground">No immediate tasks.</li>
            ) : (
              operations.nextTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span className="min-w-0 truncate">{task.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${priorityClass(task.priority)}`}>
                      {task.priority}
                    </span>
                    <Link href={task.href} className="text-xs font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </SectionCard>
  );
}
