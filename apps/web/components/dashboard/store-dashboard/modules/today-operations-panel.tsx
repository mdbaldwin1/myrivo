import Link from "next/link";
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
  const fulfillmentRows = [
    {
      id: "pending-fulfillment",
      label: "Pending fulfillment",
      value: operations.pendingFulfillment,
      href: "/orders"
    },
    {
      id: "packing",
      label: "Packing",
      value: operations.packing,
      href: "/orders"
    },
    {
      id: "shipping-exceptions",
      label: "Shipping exceptions",
      value: operations.shippingExceptions,
      href: "/orders"
    },
    {
      id: "pickup-due",
      label: "Pickup due soon",
      value: operations.duePickupWindows,
      href: "/orders"
    }
  ];

  return (
    <SectionCard title="Fulfillment" description="Current order flow and the next actions that need attention." className="h-full">
      <div className="space-y-4">
        <ul className="space-y-2 text-sm">
          {fulfillmentRows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="min-w-0 truncate">{row.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{row.value}</span>
                <Link href={row.href} className="text-xs font-medium text-primary hover:underline">
                  Open
                </Link>
              </div>
            </li>
          ))}
          {operations.overdueFulfillment > 0 ? (
            <li className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="min-w-0 truncate">Overdue fulfillment</span>
              <span className="font-semibold">{operations.overdueFulfillment}</span>
            </li>
          ) : null}
        </ul>

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
