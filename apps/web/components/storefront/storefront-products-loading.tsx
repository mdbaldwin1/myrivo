import { StorefrontLoadingShell } from "@/components/storefront/storefront-loading-shell";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontProductsLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontProductsLoading({ context }: StorefrontProductsLoadingProps) {
  const { themeConfig, surfaceClass } = context;

  return (
    <StorefrontLoadingShell context={context}>
      <section className="space-y-3 border-b border-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] pb-5">
        <div className="h-4 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_22%,transparent)] motion-reduce:animate-none" />
        <div className="h-10 w-56 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {themeConfig.productsFilterLayout === "sidebar" ? (
          <aside className={cn("hidden lg:block space-y-4 p-4", surfaceClass)}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`filter-${index}`} className="space-y-3">
                <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] motion-reduce:animate-none" />
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                  <div className="h-4 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                  <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </aside>
        ) : null}

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className={cn("h-11 animate-pulse motion-reduce:animate-none", surfaceClass)} />
            <div className={cn("h-11 animate-pulse motion-reduce:animate-none", surfaceClass)} />
            <div className={cn("h-11 animate-pulse motion-reduce:animate-none", surfaceClass)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: themeConfig.productGridColumns + 1 }).map((_, index) => (
              <div key={`product-${index}`} className={cn("space-y-4 p-4", surfaceClass)}>
                <div className={cn("aspect-[4/5] animate-pulse motion-reduce:animate-none", surfaceClass)} />
                <div className="space-y-2">
                  <div className="h-5 w-3/4 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
                  <div className="h-4 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
                  <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
                </div>
                <div className="h-10 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_24%,transparent)] motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </StorefrontLoadingShell>
  );
}
