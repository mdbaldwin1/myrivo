import { StorefrontLoadingShell } from "@/components/storefront/storefront-loading-shell";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontCheckoutLoadingProps = {
  context: StorefrontLoadingContext;
};

export function StorefrontCheckoutLoading({ context }: StorefrontCheckoutLoadingProps) {
  const { surfaceClass } = context;

  return (
    <StorefrontLoadingShell context={context}>
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-4 w-28 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_20%,transparent)] motion-reduce:animate-none" />
          <div className="mx-auto h-10 w-56 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
          <div className="mx-auto h-4 w-2/3 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
        </div>

        <div className={cn("space-y-5 p-6", surfaceClass)}>
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`detail-${index}`}
                  className="h-4 w-full animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-[color:color-mix(in_srgb,var(--storefront-text)_12%,transparent)] pt-5">
            <div className="h-5 w-32 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_16%,transparent)] motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-4 w-1/2 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-primary)_18%,transparent)] motion-reduce:animate-none" />
              <div className="h-4 w-2/3 animate-pulse bg-[color:color-mix(in_srgb,var(--storefront-text)_10%,transparent)] motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </section>
    </StorefrontLoadingShell>
  );
}
