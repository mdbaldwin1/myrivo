import React from "react";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

export default function StorefrontLoading() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 focus:outline-none">
      <section className="h-44 animate-pulse rounded-2xl border border-border bg-muted/30 motion-reduce:animate-none" />
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30 motion-reduce:animate-none" />
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30 motion-reduce:animate-none" />
        </div>
        <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30 motion-reduce:animate-none" />
      </section>
    </main>
  );
}
