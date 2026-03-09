"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";

type StorefrontHeaderNavItem = {
  label: string;
  href: string;
};

type StorefrontHeaderProps = {
  storeName: string;
  logoPath?: string | null;
  showTitle?: boolean;
  containerClassName: string;
  navItems: StorefrontHeaderNavItem[];
  rightContent?: React.ReactNode;
  buttonRadiusClass?: string;
  topOffsetPx?: number;
};

export function StorefrontHeader(props: StorefrontHeaderProps) {
  const {
    storeName,
    logoPath,
    showTitle = true,
    containerClassName,
    navItems,
    rightContent,
    buttonRadiusClass = "rounded-md",
    topOffsetPx = 0
  } = props;
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStoreParam = searchParams?.get("store")?.trim() ?? "";
  const previewPathMatch = pathname?.match(/^\/s\/([^/]+)$/);
  const previewStoreSlug = previewPathMatch?.[1]?.trim() ?? "";
  const homeHref = previewStoreSlug
    ? `/s/${encodeURIComponent(previewStoreSlug)}`
    : currentStoreParam
      ? `/s/${encodeURIComponent(currentStoreParam)}`
      : "/";

  useEffect(() => {
    const COMPACT_ENTER_Y = 96;
    const COMPACT_EXIT_Y = 72;

    function onScroll() {
      const y = window.scrollY;
      if (y >= COMPACT_ENTER_Y) {
        setIsCompact(true);
        return;
      }

      if (y <= COMPACT_EXIT_Y) {
        setIsCompact(false);
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="h-[16rem] w-full" />
      <header
        style={{ top: `${topOffsetPx}px` }}
        className={cn(
          "fixed left-0 right-0 z-50 border-b border-border/60 bg-[color:var(--storefront-header-bg)] text-[color:var(--storefront-header-fg)]",
          "transition-all duration-200"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full items-center justify-between gap-4 px-4 sm:px-6",
            containerClassName,
            isCompact ? "py-2.5" : "py-12"
          )}
        >
          <Link href={homeHref} className="flex items-center gap-3">
          {logoPath ? (
            <Image
              src={logoPath}
              alt={`${storeName} logo`}
              width={800}
              height={320}
              loading="eager"
              unoptimized
              className={cn(
                "h-auto object-contain transition-all duration-200",
                buttonRadiusClass,
                isCompact ? "h-12 w-auto max-w-[40vw] sm:max-w-[260px]" : "h-40 w-auto max-w-[75vw] sm:max-w-[620px]"
              )}
            />
          ) : (
              <div
                className={cn(
                  "flex items-center justify-center bg-muted text-xs font-semibold transition-all duration-200",
                  buttonRadiusClass,
                  isCompact ? "h-9 w-9" : "h-28 w-28"
                )}
              >
                {storeName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {showTitle ? <span className={cn("font-medium transition-all duration-200", isCompact ? "text-sm" : "text-2xl")}>{storeName}</span> : null}
          </Link>

          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-5 text-sm text-[color:var(--storefront-header-fg)]/75 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                    "px-2 py-1 hover:text-[color:var(--storefront-header-fg)]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="text-[color:var(--storefront-header-fg)]">{rightContent}</div>
          </div>
        </div>
      </header>
    </>
  );
}
