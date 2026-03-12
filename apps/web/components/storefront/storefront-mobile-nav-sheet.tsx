"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useHasMounted } from "@/components/use-has-mounted";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [isOpen, setIsOpen] = useState(false);
  const resolvedPath = pathname ?? currentPath ?? null;

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
    <Sheet key={resolvedPath ?? "storefront-mobile-nav"} open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open storefront navigation menu"
          className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-[color:var(--storefront-surface)] text-[color:var(--storefront-header-fg)] hover:bg-[color:var(--storefront-surface)]/90 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border/70 px-5 py-5 text-left">
          <SheetTitle>{storeName}</SheetTitle>
          <SheetDescription>Browse every page in the storefront from your phone.</SheetDescription>
        </SheetHeader>
        <nav className="min-h-0 flex-1 overflow-y-auto border-y border-border/60">
          <ul>
            {navItems.map((item) => {
              const isActive = isStorefrontNavLinkActive(resolvedPath, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
