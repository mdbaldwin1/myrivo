import { StorefrontLoadingShell } from "@/components/storefront/storefront-loading-shell";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontHomeLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontHomeLoading({ context }: StorefrontHomeLoadingProps) {
  const { themeConfig, surfaceClass, contentGapClass, isAiry } = context;
  const isSplitHero = themeConfig.heroLayout === "split";

  return (
    <StorefrontLoadingShell context={context}>
      <section className={cn("space-y-4", isAiry && "space-y-6")}>
        <div className="h-8 w-40 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_22%,transparent)] motion-reduce:animate-none" />
        <div className="flex items-center justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] pb-4">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="h-10 w-48 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_18%,transparent)] motion-reduce:animate-none" />
          </div>
          <div className="hidden gap-3 md:flex">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`nav-${index}`}
                className="h-4 w-16 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className={cn(
          "grid items-stretch",
          contentGapClass,
          isSplitHero ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]" : "justify-items-center"
        )}
      >
        <div className={cn("space-y-4", !isSplitHero && "max-w-3xl text-center")}>
          <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_24%,transparent)] motion-reduce:animate-none" />
          <div className="space-y-3">
            <div className="h-12 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="h-12 w-4/5 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
            <div className="h-4 w-5/6 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
          </div>
          <div className={cn("flex flex-wrap gap-3", !isSplitHero && "justify-center")}>
            <div className={cn("h-11 w-36 animate-pulse motion-reduce:animate-none", surfaceClass)} />
            <div className={cn("h-11 w-32 animate-pulse motion-reduce:animate-none", surfaceClass)} />
          </div>
        </div>
        <div
          className={cn(
            "min-h-[18rem] animate-pulse motion-reduce:animate-none",
            surfaceClass,
            isSplitHero ? "h-full" : "mt-2 w-full max-w-2xl"
          )}
        />
      </section>

      <section className={cn("grid", contentGapClass, "md:grid-cols-3")}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`content-${index}`} className={cn("space-y-3 p-5", surfaceClass)}>
            <div className="h-3 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_22%,transparent)] motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
              <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
              <div className="h-4 w-5/6 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_22%,transparent)] motion-reduce:animate-none" />
            <div className="h-8 w-52 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
          </div>
          <div className="hidden h-10 w-40 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-surface)_90%,transparent)] md:block motion-reduce:animate-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: themeConfig.productGridColumns }).map((_, index) => (
            <div key={`product-${index}`} className={cn("space-y-4 p-4", surfaceClass)}>
              <div className={cn("aspect-[4/5] animate-pulse motion-reduce:animate-none", surfaceClass)} />
              <div className="space-y-2">
                <div className="h-5 w-3/4 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
              </div>
              <div className="h-10 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_26%,transparent)] motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] pt-6">
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`footer-${index}`} className="space-y-3">
              <div className="h-3 w-16 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
                <div className="h-4 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </footer>
    </StorefrontLoadingShell>
  );
}
