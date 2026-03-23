import { StorefrontLoadingShell } from "@/components/storefront/storefront-loading-shell";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontEditorialLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontEditorialLoading({ context }: StorefrontEditorialLoadingProps) {
  const { surfaceClass } = context;

  return (
    <StorefrontLoadingShell context={context}>
      <section className="space-y-3 border-b border-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] pb-5">
        <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
        <div className="h-10 w-64 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
      </section>

      <section className="mx-auto max-w-4xl space-y-6">
        <div className={cn("space-y-4 p-6", surfaceClass)}>
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={`paragraph-${index}`}
              className={cn(
                "h-4 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none",
                index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-11/12" : "w-4/5"
              )}
            />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn("space-y-3 p-5", surfaceClass)}>
            <div className="h-5 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
              <div className="h-4 w-5/6 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
            </div>
          </div>
          <div className={cn("space-y-3 p-5", surfaceClass)}>
            <div className="h-5 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
              <div className="h-4 w-2/3 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </section>
    </StorefrontLoadingShell>
  );
}
