"use client";

import { Button } from "@/components/ui/button";

type DashboardErrorProps = {
  error: Error;
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Dashboard Error</h1>
        <p className="text-sm text-muted-foreground">{error.message || "An unexpected issue occurred while loading your dashboard."}</p>
        <Button type="button" onClick={reset}>
          Retry
        </Button>
      </section>
    </main>
  );
}
