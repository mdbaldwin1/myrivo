import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubActivityPanelProps = {
  activity: StoreHubData["activity"];
};

export function StoreHubActivityPanel({ activity }: StoreHubActivityPanelProps) {
  return (
    <SectionCard title="Recent Activity" description="Latest order, inventory, and settings events across stores.">
      <ul className="space-y-2 text-sm">
        {activity.length === 0 ? (
          <li className="text-muted-foreground">No recent cross-store activity.</li>
        ) : (
          activity.slice(0, 12).map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
              </div>
              <Link href={item.href} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                Open
              </Link>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}
