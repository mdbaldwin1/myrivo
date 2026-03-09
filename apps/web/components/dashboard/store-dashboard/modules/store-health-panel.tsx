import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type StoreHealthPanelProps = {
  health: StoreDashboardData["health"];
  errorMessage?: string;
  retryHref: string;
};

function statusClass(status: "ready" | "action_needed") {
  return status === "ready"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-amber-300 bg-amber-50 text-amber-700";
}

export function StoreHealthPanel({ health, errorMessage, retryHref }: StoreHealthPanelProps) {
  return (
    <SectionCard title="Store Health" description="Readiness score across payments, domain, catalog, and checkout setup.">
      <div className="space-y-3">
        <AppAlert
          variant="warning"
          message={errorMessage ?? null}
          action={
            <Link href={retryHref} className="text-xs font-medium underline">
              Retry
            </Link>
          }
        />
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Health Score</p>
          <p className="mt-1 text-3xl font-semibold">{health.score}</p>
        </div>
        <ul className="space-y-2 text-sm">
          {health.checks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div>
                <p className="font-medium">{check.label}</p>
                <p className="text-xs text-muted-foreground">Weight: {check.weight}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${statusClass(check.status)}`}>
                  {check.status === "ready" ? "ready" : "action needed"}
                </span>
                <Link href={check.href} className="text-xs font-medium text-primary hover:underline">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
