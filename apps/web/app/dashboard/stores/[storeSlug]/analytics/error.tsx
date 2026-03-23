"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type StoreWorkspaceAnalyticsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function StoreWorkspaceAnalyticsError({ error, reset }: StoreWorkspaceAnalyticsErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-3 p-3">
      <SectionCard
        title="Analytics unavailable"
        description="We could not load storefront analytics right now. This usually means the dashboard query failed or analytics data is still being initialized."
        action={
          <Button onClick={reset} size="sm">
            Retry
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          If this continues, check the analytics collection route and the latest dashboard deploy logs before escalating it as a data issue.
        </p>
      </SectionCard>
    </div>
  );
}
