import { cn } from "@/lib/utils";

function Block({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function PageShell({
  children,
  titleWidth = "w-44",
  descriptionWidth = "w-80",
  className
}: {
  children: React.ReactNode;
  titleWidth?: string;
  descriptionWidth?: string;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3 p-3", className)}>
      <header className="rounded-md border border-border/70 bg-white px-4 py-2.5 shadow-sm">
        <div className="space-y-2">
          <Block className={cn("h-7", titleWidth)} />
          <Block className={cn("h-4 max-w-full", descriptionWidth)} />
        </div>
      </header>
      {children}
    </section>
  );
}

export function OverviewLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-32" descriptionWidth="w-[28rem]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Block className="h-80 xl:col-span-2" />
        <Block className="h-80" />
      </div>
    </PageShell>
  );
}

export function CatalogLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-28" descriptionWidth="w-[26rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <Block className="h-9 w-40" />
          <Block className="h-9 w-40" />
          <Block className="h-9 w-32" />
        </div>
        <div className="space-y-2">
          <Block className="h-10 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}

export function OrdersLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-24" descriptionWidth="w-[24rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <Block className="h-9" />
          <Block className="h-9" />
          <Block className="h-9" />
        </div>
        <div className="space-y-2">
          <Block className="h-10 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}

export function FormWithActionBarLoadingSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <header className="rounded-md border border-border/70 bg-white px-4 py-2.5 shadow-sm">
          <div className="space-y-2">
            <Block className="h-7 w-44" />
            <Block className="h-4 w-[22rem] max-w-full" />
          </div>
        </header>
        {Array.from({ length: sections }).map((_, index) => (
          <div key={`form-section-${index}`} className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="mb-4 space-y-2 border-b border-border/60 pb-4">
              <Block className="h-6 w-40" />
              <Block className="h-4 w-64 max-w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Block className="h-10" />
              <Block className="h-10" />
              <Block className="h-10 sm:col-span-2" />
              <Block className="h-24 sm:col-span-2" />
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border/70 bg-white p-3">
        <div className="flex justify-end gap-2">
          <Block className="h-9 w-24" />
          <Block className="h-9 w-28" />
        </div>
      </div>
    </section>
  );
}

export function ContentWorkspaceLoadingSkeleton() {
  return <FormWithActionBarLoadingSkeleton sections={1} />;
}

export function IntegrationsLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-32" descriptionWidth="w-[28rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 space-y-2 border-b border-border/60 pb-4">
          <Block className="h-6 w-36" />
          <Block className="h-4 w-64 max-w-full" />
        </div>
        <div className="space-y-3">
          <Block className="h-10 w-full" />
          <Block className="h-10 w-full" />
          <Block className="h-10 w-full" />
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <Block className="h-44 w-full" />
      </div>
    </PageShell>
  );
}

export function MarketingLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-52" descriptionWidth="w-[24rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex justify-between">
          <Block className="h-9 w-40" />
          <Block className="h-9 w-28" />
        </div>
        <div className="space-y-2">
          <Block className="h-10 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}

export function ReportsLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-44" descriptionWidth="w-[28rem]">
      <div className="grid gap-4 xl:grid-cols-3">
        <Block className="h-72 xl:col-span-2" />
        <Block className="h-72" />
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <Block className="h-10 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}

export function TeamLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-20" descriptionWidth="w-[24rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex justify-between">
          <Block className="h-9 w-44" />
          <Block className="h-9 w-28" />
        </div>
        <div className="space-y-2">
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}

export function PlatformLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-44" descriptionWidth="w-[22rem]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Block className="h-24" />
            <Block className="h-24" />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Block className="h-20" />
            <Block className="h-20" />
            <Block className="h-20" />
            <Block className="h-20" />
          </div>
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Block className="h-32" />
            <Block className="h-32" />
          </div>
          <Block className="h-56 w-full" />
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4 flex justify-end">
            <Block className="h-9 w-48" />
          </div>
          <div className="space-y-2">
            <Block className="h-14 w-full" />
            <Block className="h-14 w-full" />
            <Block className="h-14 w-full" />
            <Block className="h-14 w-full" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function StoreControlTowerLoadingSkeleton() {
  return (
    <PageShell titleWidth="w-56" descriptionWidth="w-[30rem]">
      <Block className="h-16 w-full" />
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <Block className="h-10 w-full" />
          <Block className="h-10 w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Block className="h-80 lg:col-span-8" />
        <Block className="h-80 lg:col-span-4" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Block className="h-80 lg:col-span-8" />
        <Block className="h-80 lg:col-span-4" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Block className="h-80 lg:col-span-4" />
        <Block className="h-80 lg:col-span-8" />
      </div>
    </PageShell>
  );
}
