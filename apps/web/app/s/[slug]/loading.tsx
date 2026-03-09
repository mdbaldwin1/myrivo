export default function StorefrontLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <section className="h-44 animate-pulse rounded-2xl border border-border bg-muted/30" />
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
        </div>
        <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
      </section>
    </main>
  );
}
