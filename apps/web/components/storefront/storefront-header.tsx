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
  const previewNavigateToHref = studioEnabled ? runtime?.previewNavigateToHref ?? null : null;
  const themeConfig = resolveStorefrontThemeConfig(runtime?.branding?.theme_json ?? {});
  const [isCompact, setIsCompact] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(256);
  const [reservedHeaderMeasurement, setReservedHeaderMeasurement] = useState<{ signature: string; height: number }>({
    signature: "",
    height: 0
  });
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
  const headerMeasurementSignature = [studioEnabled ? "studio" : "live", pathname ?? "", storeName, logoPath ?? "", showLogo ? "logo" : "no-logo", showTitle ? "title" : "no-title", containerClassName, String(topOffsetPx)].join("|");

  useEffect(() => {
    const COMPACT_ENTER_Y = 72;
    const COMPACT_EXIT_Y = 48;
    const MIN_SCROLL_RANGE_FOR_COMPACT_ENTER = 160;
    const MIN_SCROLL_RANGE_FOR_COMPACT_EXIT = 120;
    const ownerDocument = headerRef.current?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const scrollRoot = studioEnabled
      ? ((headerRef.current?.closest('[data-storefront-scroll-root="true"]') as HTMLElement | null) ?? null)
      : null;

    function getMaxScroll() {
      if (scrollRoot) {
        return Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      }

      const doc = ownerDocument.documentElement;
      return Math.max(0, doc.scrollHeight - ownerWindow.innerHeight);
    }

    function onScroll() {
      const maxScroll = getMaxScroll();
      const y = scrollRoot ? scrollRoot.scrollTop : ownerWindow.scrollY;
      setIsCompact((current) => {
        if (current) {
          if (maxScroll <= MIN_SCROLL_RANGE_FOR_COMPACT_EXIT) {
            return false;
          }

          if (y <= COMPACT_EXIT_Y) {
            return false;
          }

          return true;
        }

        if (maxScroll <= MIN_SCROLL_RANGE_FOR_COMPACT_ENTER) {
          return false;
        }

        if (y >= COMPACT_ENTER_Y) {
          return true;
        }

        return false;
      });
    }

    onScroll();
    const target: HTMLElement | Window = scrollRoot ?? ownerWindow;
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
      const nextHeight = nextHeader.getBoundingClientRect().height;
      setHeaderHeight(nextHeight);
      setReservedHeaderMeasurement((current) => {
        if (current.signature !== headerMeasurementSignature) {
          return {
            signature: headerMeasurementSignature,
            height: nextHeight
          };
        }

        return {
          signature: current.signature,
          height: Math.max(current.height, nextHeight)
        };
      });
    }

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(header);

    return () => {
      observer.disconnect();
    };
  }, [containerClassName, headerMeasurementSignature, logoPath, showLogo, showTitle, storeName, studioEnabled, topOffsetPx]);

  const effectiveIsCompact = isCompact;
  const resolvedReservedHeaderHeight =
    reservedHeaderMeasurement.signature === headerMeasurementSignature
      ? Math.max(reservedHeaderMeasurement.height, headerHeight)
      : headerHeight;

  const shouldRenderLogo = Boolean(showLogo && logoPath);
  const shouldRenderTitle = showTitle || !shouldRenderLogo;

  const headerElement = (
    <header
      ref={headerRef}
      data-storefront-preview-section="header"
      style={{ top: `${topOffsetPx}px` }}
      className={cn(
        studioEnabled ? "sticky inset-x-0 z-40" : "fixed left-0 right-0 z-50",
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
          onNavigateHref={previewNavigateToHref}
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
                  onClick={(event) => {
                    if (!previewNavigateToHref) {
                      return;
                    }

                    event.preventDefault();
                    previewNavigateToHref(event.currentTarget.href);
                  }}
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
  );

  if (studioEnabled) {
    return headerElement;
  }

  return (
    <>
      <div aria-hidden="true" style={{ height: `${resolvedReservedHeaderHeight + topOffsetPx}px` }} className="w-full" />
      {headerElement}
    </>
  );
}
