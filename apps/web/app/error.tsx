"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type AppErrorProps = {
  error: Error;
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-6 py-12 md:px-10">
      <section className="w-full space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">We hit a storefront error</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something unexpected happened while loading this page."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Retry
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/">Back to storefront</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
