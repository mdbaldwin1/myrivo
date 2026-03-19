import { StorefrontLoadingShell } from "@/components/storefront/storefront-loading-shell";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontCartLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontCartLoading({ context }: StorefrontCartLoadingProps) {
  const { surfaceClass } = context;

  return (
    <StorefrontLoadingShell context={context}>
      <section className="space-y-3">
        <div className="h-4 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
        <div className="h-10 w-48 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`cart-item-${index}`} className={cn("grid gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)]", surfaceClass)}>
              <div className={cn("aspect-square animate-pulse motion-reduce:animate-none", surfaceClass)} />
              <div className="space-y-3">
                <div className="h-5 w-3/4 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
                <div className="flex items-center justify-between gap-3">
                  <div className={cn("h-10 w-32 animate-pulse motion-reduce:animate-none", surfaceClass)} />
                  <div className="h-5 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className={cn("space-y-4 p-5", surfaceClass)}>
          <div className="h-6 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`summary-${index}`} className="flex items-center justify-between gap-3">
                <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-16 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
              </div>
            ))}
          </div>
          <div className="h-11 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_24%,transparent)] motion-reduce:animate-none" />
        </aside>
      </section>
    </StorefrontLoadingShell>
  );
}
