import type { ReactNode } from "react";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import type { StorefrontLoadingContext } from "@/lib/storefront/loading-theme";
import { cn } from "@/lib/utils";

type StorefrontLoadingShellProps = {
  context: StorefrontLoadingContext;
  children: ReactNode;
};

export function StorefrontLoadingShell({ context, children }: StorefrontLoadingShellProps) {
  const { themeStyle, pageWidthClass, spacingClass } = context;

  return (
    <div
      style={{ ...themeStyle, backgroundImage: "none", backgroundAttachment: "fixed" }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={cn("mx-auto w-full focus:outline-none", pageWidthClass, spacingClass)}
      >
        {children}
      </main>
    </div>
  );
}
