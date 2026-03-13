import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontProductDetailLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontProductDetailLoading({ context }: StorefrontProductDetailLoadingProps) {
  const { themeStyle, pageWidthClass, spacingClass, surfaceClass } = context;

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      style={themeStyle}
      className={cn(
        "mx-auto min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)] focus:outline-none",
        pageWidthClass,
        spacingClass
      )}
    >
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] motion-reduce:animate-none" />
        <div className="h-4 w-40 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-4">
          <div className={cn("aspect-[4/5] animate-pulse motion-reduce:animate-none", surfaceClass)} />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`thumb-${index}`} className={cn("aspect-square animate-pulse motion-reduce:animate-none", surfaceClass)} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="h-10 w-5/6 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="h-6 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_22%,transparent)] motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
          </div>

          <div className={cn("space-y-4 p-5", surfaceClass)}>
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_14%,transparent)] motion-reduce:animate-none" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`option-${index}`}
                    className={cn("h-10 w-24 animate-pulse motion-reduce:animate-none", surfaceClass)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-4 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-32 animate-pulse motion-reduce:animate-none", surfaceClass)} />
                <div className="h-11 flex-1 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_24%,transparent)] motion-reduce:animate-none" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
            <div className="h-4 w-11/12 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
            <div className="h-4 w-5/6 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
          </div>
        </div>
      </section>
    </main>
  );
}
