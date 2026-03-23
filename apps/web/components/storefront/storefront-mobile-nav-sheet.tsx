"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useHasMounted } from "@/components/use-has-mounted";
import { Button } from "@/components/ui/button";
import { useOptionalSurfacePortalContainer } from "@/components/ui/surface-portal-context";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { cn } from "@/lib/utils";

type StorefrontMobileNavSheetProps = {
  storeName: string;
  navItems: Array<{
    label: string;
    href: string;
  }>;
  currentPath?: string | null;
};

function normalizeNavPath(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const normalized = value.split("#")[0]?.split("?")[0]?.trim() ?? "";
  if (!normalized) {
    return "";
  }
  return normalized.endsWith("/") && normalized !== "/" ? normalized.slice(0, -1) : normalized;
}

export function isStorefrontNavLinkActive(currentPath: string | null | undefined, href: string) {
  const activePath = normalizeNavPath(currentPath);
  const hrefPath = normalizeNavPath(href);

  if (!activePath || !hrefPath) {
    return false;
  }

  return activePath === hrefPath || activePath.startsWith(`${hrefPath}/`);
}

export function StorefrontMobileNavSheet({ storeName, navItems, currentPath }: StorefrontMobileNavSheetProps) {
  const hasMounted = useHasMounted();
  const pathname = usePathname();
  const runtime = useOptionalStorefrontRuntime();
  const portalContainer = useOptionalSurfacePortalContainer();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedPath = pathname ?? currentPath ?? null;
  const previewNavigationEnabled = runtime?.mode === "studio";
  const titleId = "storefront-mobile-nav-sheet-title";
  const descriptionId = "storefront-mobile-nav-sheet-description";
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (navItems.length === 0) {
    return null;
  }

  if (!hasMounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open storefront navigation menu"
        className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-[color:var(--storefront-surface)] text-[color:var(--storefront-header-fg)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open storefront navigation menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "storefront-mobile-nav-drawer" : undefined}
        onClick={() => setIsOpen(true)}
        className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-[color:var(--storefront-surface)] text-[color:var(--storefront-header-fg)] hover:bg-[color:var(--storefront-surface)]/90 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>
      {isOpen
        ? createPortal(
            <div className="md:hidden">
              <button
                type="button"
                aria-label="Close storefront navigation menu"
                className="fixed inset-0 z-[80] bg-black/45"
                onClick={() => setIsOpen(false)}
              />
              <div
                id="storefront-mobile-nav-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                data-storefront-preview-nav-sheet="true"
                className="fixed inset-y-0 left-0 z-[81] flex h-full w-[88vw] max-w-sm flex-col gap-0 border-r bg-background p-0 shadow-lg"
              >
                <h2 id={titleId} className="sr-only">
                  {storeName} navigation menu
                </h2>
                <p id={descriptionId} className="sr-only">
                  Browse every page in the storefront from your phone.
                </p>
                <div className="border-b border-border/70 px-5 py-5 text-left">
                  <p className="text-lg font-semibold text-foreground">{storeName}</p>
                  <p className="text-sm text-muted-foreground">Browse every page in the storefront from your phone.</p>
                </div>
                <nav className="min-h-0 flex-1 overflow-y-auto border-y border-border/60">
                  <ul>
                    {navItems.map((item) => {
                      const isActive = isStorefrontNavLinkActive(resolvedPath, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={(event) => {
                              if (previewNavigationEnabled) {
                                event.preventDefault();
                                runtime?.previewNavigateToHref?.(event.currentTarget.href);
                              }

                              setIsOpen(false);
                            }}
                            className={cn(
                              STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                              "flex min-h-14 w-full items-center justify-center border-b border-border/60 px-5 py-3 text-center text-base font-medium text-[color:var(--storefront-text)] transition-colors last:border-b-0 hover:bg-muted/20",
                              isActive && "bg-[color:var(--storefront-primary)]/8 text-[color:var(--storefront-text)]"
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>,
            portalContainer ?? document.body
          )
        : null}
    </>
  );
}
