"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isStorefrontNavLinkActive, StorefrontMobileNavSheet } from "@/components/storefront/storefront-mobile-nav-sheet";
import { StorefrontStudioEditableLogo } from "@/components/storefront/storefront-studio-editable-logo";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { cn } from "@/lib/utils";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";

type StorefrontHeaderNavItem = {
  label: string;
  href: string;
};

type StorefrontHeaderProps = {
  storeName: string;
  logoPath?: string | null;
  showLogo?: boolean;
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
    showLogo = true,
    showTitle = true,
    containerClassName,
    navItems,
    rightContent,
    buttonRadiusClass = "rounded-md",
    topOffsetPx = 0
  } = props;
  const runtime = useOptionalStorefrontRuntime();
  const studioEnabled = runtime?.mode === "studio";
  const themeConfig = resolveStorefrontThemeConfig(runtime?.branding?.theme_json ?? {});
  const [isCompact, setIsCompact] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(256);
  const headerRef = useRef<HTMLElement | null>(null);
  const runtimeStoreSlug = runtime?.store.slug?.trim() ?? "";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStoreParam = searchParams?.get("store")?.trim() ?? "";
  const previewPathMatch = pathname?.match(/^\/s\/([^/]+)$/);
  const previewStoreSlug = previewPathMatch?.[1]?.trim() ?? "";
  const homeHref = previewStoreSlug
    ? `/s/${encodeURIComponent(previewStoreSlug)}`
    : runtimeStoreSlug
      ? `/s/${encodeURIComponent(runtimeStoreSlug)}`
    : currentStoreParam
      ? `/s/${encodeURIComponent(currentStoreParam)}`
      : "/";

  useEffect(() => {
    const COMPACT_ENTER_Y = 72;
    const COMPACT_EXIT_Y = 48;
    const MIN_SCROLL_RANGE_FOR_COMPACT = 160;
    const scrollRoot = studioEnabled
      ? ((headerRef.current?.closest('[data-storefront-scroll-root="true"]') as HTMLElement | null) ?? null)
      : null;

    function getMaxScroll() {
      if (scrollRoot) {
        return Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      }

      const doc = document.documentElement;
      return Math.max(0, doc.scrollHeight - window.innerHeight);
    }

    function onScroll() {
      const maxScroll = getMaxScroll();
      if (maxScroll <= MIN_SCROLL_RANGE_FOR_COMPACT) {
        setIsCompact(false);
        return;
      }

      const y = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      if (y >= COMPACT_ENTER_Y) {
        setIsCompact(true);
        return;
      }

      if (y <= COMPACT_EXIT_Y) {
        setIsCompact(false);
      }
    }

    onScroll();
    const target: HTMLElement | Window = scrollRoot ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
    };
  }, [studioEnabled]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    function syncHeight() {
      const nextHeader = headerRef.current;
      if (!nextHeader) {
        return;
      }
      setHeaderHeight(nextHeader.getBoundingClientRect().height);
    }

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(header);

    return () => {
      observer.disconnect();
    };
  }, [showLogo, showTitle, logoPath, storeName, containerClassName, isCompact, topOffsetPx]);

  const effectiveIsCompact = isCompact;

  const shouldRenderLogo = Boolean(showLogo && logoPath);
  const shouldRenderTitle = showTitle || !shouldRenderLogo;

  return (
    <>
      <div aria-hidden="true" style={{ height: `${headerHeight + topOffsetPx}px` }} className="w-full" />
      <header
        ref={headerRef}
        data-storefront-preview-section="header"
        style={{ top: `${topOffsetPx}px` }}
        className={cn(
          studioEnabled ? "absolute inset-x-0 z-40" : "fixed left-0 right-0 z-50",
          "border-b border-border/60 bg-[color:var(--storefront-header-bg)] text-[color:var(--storefront-header-fg)]",
          "transition-all duration-200 motion-reduce:transition-none"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full items-center justify-between gap-3 px-4 sm:px-6",
            containerClassName,
            effectiveIsCompact ? "py-2.5 sm:py-3" : "py-4 sm:py-6 lg:py-10"
          )}
        >
          <StorefrontStudioEditableLogo
            href={homeHref}
            logoPath={logoPath}
            storeName={storeName}
            showLogo={showLogo}
            showTitle={shouldRenderTitle}
            logoSize={themeConfig.headerLogoSize}
            titleSize={themeConfig.headerTitleSize}
            buttonRadiusClass={buttonRadiusClass}
            compact={effectiveIsCompact}
          />

          <div className="flex items-center gap-2.5 sm:gap-4">
            <StorefrontMobileNavSheet storeName={storeName} navItems={navItems} currentPath={pathname} />
            <nav className="hidden items-center gap-5 text-sm text-[color:var(--storefront-header-fg)]/75 md:flex">
              {navItems.map((item) => {
                const isActive = isStorefrontNavLinkActive(pathname, item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                      "px-2 py-1 hover:text-[color:var(--storefront-header-fg)]",
                      isActive && "text-[color:var(--storefront-header-fg)]"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="text-[color:var(--storefront-header-fg)]">{rightContent}</div>
          </div>
        </div>
      </header>
    </>
  );
}
