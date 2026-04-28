"use client";

import Link from "next/link";
import { Bell, Expand, ExternalLink, Gift, Monitor, Package, PanelBottom, PanelLeftClose, PanelLeftOpen, PanelTop, Smartphone, SwatchBook, Tablet, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StorefrontStudioCanvas } from "@/components/dashboard/storefront-studio-canvas";
import { StorefrontStudioDocumentProvider } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioEditorTargetMenu } from "@/components/dashboard/storefront-studio-editor-target-menu";
import { StorefrontStudioPreviewViewport } from "@/components/dashboard/storefront-studio-preview-viewport";
import {
  StorefrontStudioStorefrontEditorPanel,
  type StorefrontStudioStorefrontEditorTarget
} from "@/components/dashboard/storefront-studio-storefront-editor-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { readLocalStorageFlag, useLocalStorageFlag, writeLocalStorageFlag } from "@/components/dashboard/use-local-storage-flag";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildStorefrontStudioSurfaceHref,
  getStorefrontStudioSurface,
  normalizeStorefrontStudioEditorTarget,
  normalizeStorefrontStudioSurface,
  storefrontStudioSurfaces,
  type StorefrontStudioSurfaceId
} from "@/lib/store-editor/storefront-studio";
import { setStoreAlertStudioPreview } from "@/lib/storefront/store-alert";
import { setWelcomePopupStudioPreview, STOREFRONT_WELCOME_POPUP_SURFACES } from "@/lib/storefront/welcome-popup";
import type { StorefrontData } from "@/lib/storefront/runtime";
import { cn } from "@/lib/utils";

type StorefrontStudioProps = {
  storeSlug: string;
  initialSurface?: string | null;
  initialEditorTarget?: string | null;
  initialStorefrontData: StorefrontData | null;
};

type ViewportMode = "fill" | "desktop" | "tablet" | "mobile";
type PageSurfaceId = Exclude<StorefrontStudioSurfaceId, "emails">;
type PreviewScrollTarget = { section: "header" | "footer"; nonce: number } | null;
type EditorTargetItem = {
  id: StorefrontStudioStorefrontEditorTarget;
  label: string;
  description: string;
  icon: typeof Monitor;
};

const DASHBOARD_SIDEBAR_STORAGE_KEY = "myrivo.dashboard-sidebar-collapsed";
const STOREFRONT_STUDIO_RAIL_STORAGE_KEY = "myrivo.storefront-studio-rail-collapsed";

const viewportOptions: Array<{
  id: ViewportMode;
  label: string;
  icon: typeof Monitor;
  frameClassName: string;
  viewportWidthPx?: number;
}> = [
  {
    id: "fill",
    label: "Fill",
    icon: Monitor,
    frameClassName: "h-full w-full rounded-[1rem]"
  },
  {
    id: "desktop",
    label: "Desktop",
    icon: Monitor,
    frameClassName: "h-full w-full max-w-[88rem] rounded-[1rem]"
  },
  {
    id: "tablet",
    label: "Tablet",
    icon: Tablet,
    frameClassName: "h-full w-full max-w-[820px] rounded-[1.25rem]",
    viewportWidthPx: 820
  },
  {
    id: "mobile",
    label: "Mobile",
    icon: Smartphone,
    frameClassName: "h-full w-full max-w-[390px] rounded-[1.5rem]",
    viewportWidthPx: 390
  }
];

function resolvedInitialEditorTarget(
  initialEditorTarget: StorefrontStudioStorefrontEditorTarget | null,
  initialPageSurface: PageSurfaceId
): StorefrontStudioStorefrontEditorTarget {
  return initialEditorTarget ?? initialPageSurface;
}

export function StorefrontStudio({ storeSlug, initialSurface, initialEditorTarget, initialStorefrontData }: StorefrontStudioProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedInitialSurface = normalizeStorefrontStudioSurface(initialSurface);
  const initialPageSurface: PageSurfaceId = normalizedInitialSurface === "emails" ? "home" : normalizedInitialSurface;
  const normalizedInitialEditorTarget = normalizeStorefrontStudioEditorTarget(initialEditorTarget);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [previewScrollTarget, setPreviewScrollTarget] = useState<PreviewScrollTarget>(null);
  const railCollapsed = useLocalStorageFlag(STOREFRONT_STUDIO_RAIL_STORAGE_KEY);
  const [activeEditorTarget, setActiveEditorTarget] = useState<StorefrontStudioStorefrontEditorTarget>(
    resolvedInitialEditorTarget(normalizedInitialEditorTarget, initialPageSurface)
  );
  const [activeProductDetailHandle, setActiveProductDetailHandle] = useState<string | null>(null);
  const currentSurfaceParam = searchParams.get("surface");
  const currentEditorParam = searchParams.get("editor");
  const activeSurfaceId = normalizeStorefrontStudioSurface(currentSurfaceParam ?? initialSurface);
  const activePageSurfaceId: PageSurfaceId = activeSurfaceId === "emails" ? "home" : activeSurfaceId;
  const resolvedEditorParam = normalizeStorefrontStudioEditorTarget(currentEditorParam);
  const activeSurface = getStorefrontStudioSurface(activeSurfaceId);
  const activeViewport = viewportOptions.find((entry) => entry.id === viewport) || viewportOptions[0]!;
  const visiblePageSurfaces = useMemo(
    () => storefrontStudioSurfaces.filter((surface): surface is (typeof storefrontStudioSurfaces)[number] & { id: PageSurfaceId } => surface.id !== "emails"),
    []
  );
  const previewHref = activeSurface.previewHref(storeSlug);

  const structureTargets = useMemo(
    () => [
      {
        id: "brand" as const,
        label: "Branding",
        description: "Theme tokens and shared visual presentation.",
        icon: SwatchBook
      },
      {
        id: "header" as const,
        label: "Header",
        description: "Header presentation and shared top-of-storefront controls.",
        icon: PanelTop
      },
      {
        id: "footer" as const,
        label: "Footer",
        description: "Footer links and footer-level utility controls.",
        icon: PanelBottom
      }
    ],
    []
  );

  const pageTargets = useMemo(
    () => {
      const items: EditorTargetItem[] = visiblePageSurfaces.map((surface) => ({
        id: surface.id,
        label: surface.label.replace(" Page", ""),
        description: surface.description,
        icon: surface.icon
      }));

      const productsIndex = items.findIndex((item) => item.id === "products");
      if (productsIndex >= 0) {
        items.splice(productsIndex + 1, 0, {
          id: "productDetail",
          label: "Product Detail",
          description: "Product-page copy, CTA states, availability messaging, and review presentation.",
          icon: Package
        });
      }

      return items;
    },
    [visiblePageSurfaces]
  );
  const campaignTargets = useMemo(
    () => [
      {
        id: "welcomePopup" as const,
        label: "Welcome Popup",
        description: "First-visit email capture campaign shown across eligible storefront entry pages.",
        icon: Gift
      },
      {
        id: "storeAlert" as const,
        label: "Store Alert",
        description: "Site-wide popup for time-sensitive notices like fulfillment delays.",
        icon: Bell
      }
    ],
    []
  );

  const resolvedActiveEditorTarget: StorefrontStudioStorefrontEditorTarget = resolvedEditorParam
    ? resolvedEditorParam
    : activeEditorTarget === "brand" || activeEditorTarget === "header" || activeEditorTarget === "footer"
      ? activeEditorTarget
      : activeEditorTarget === "productDetail"
        ? "productDetail"
        : activePageSurfaceId;
  const editorTargets = useMemo(() => [...structureTargets, ...pageTargets, ...campaignTargets], [campaignTargets, pageTargets, structureTargets]);
  const activeEditorMeta = editorTargets.find((target) => target.id === resolvedActiveEditorTarget) ?? editorTargets[0]!;
  const editorTargetSections = useMemo(
    () => [
      { label: "Storefront structure", items: structureTargets },
      { label: "Pages", items: pageTargets },
      { label: "Campaigns", items: campaignTargets }
    ],
    [campaignTargets, pageTargets, structureTargets]
  );

  useEffect(() => {
    const hadPreviousValue = typeof window !== "undefined" && window.localStorage.getItem(DASHBOARD_SIDEBAR_STORAGE_KEY) !== null;
    const previousCollapsed = hadPreviousValue ? readLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY) : false;

    if (!previousCollapsed) {
      writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, true);
    }

    return () => {
      if (!hadPreviousValue) {
        window.localStorage.removeItem(DASHBOARD_SIDEBAR_STORAGE_KEY);
        window.dispatchEvent(new Event("myrivo:local-storage-change"));
        return;
      }

      if (!previousCollapsed && readLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY)) {
        writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, false);
      }
    };
  }, []);

  useEffect(() => {
    setWelcomePopupStudioPreview(storeSlug, resolvedActiveEditorTarget === "welcomePopup");
    return () => {
      setWelcomePopupStudioPreview(storeSlug, false);
    };
  }, [resolvedActiveEditorTarget, storeSlug]);

  useEffect(() => {
    setStoreAlertStudioPreview(storeSlug, resolvedActiveEditorTarget === "storeAlert");
    return () => {
      setStoreAlertStudioPreview(storeSlug, false);
    };
  }, [resolvedActiveEditorTarget, storeSlug]);

  useEffect(() => {
    if (!fullscreenPreview) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFullscreenPreview(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreenPreview]);

  function renderCanvasFrame(fullscreen: boolean) {
    return (
      <div className="flex h-full min-h-0 items-stretch justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))]">
        <div
          className={cn(
            "relative h-full min-h-0 max-h-full overflow-hidden border border-slate-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] transition-all duration-200",
            fullscreen ? "h-full w-full max-w-none rounded-none border-0 shadow-none" : activeViewport.frameClassName
          )}
        >
          {!fullscreen ? (
            <div className="pointer-events-none absolute left-4 top-4 z-[70]">
              <div className="rounded-full border border-slate-900/15 bg-slate-950/88 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] backdrop-blur">
                Preview
              </div>
            </div>
          ) : null}
          {fullscreen ? (
            <button
              type="button"
              aria-label="Close fullscreen preview"
              className="absolute right-4 top-4 z-[80] inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-900/10 bg-white/95 text-slate-900 shadow-lg backdrop-blur transition hover:bg-white"
              onClick={() => setFullscreenPreview(false)}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {activeViewport.viewportWidthPx ? (
            <StorefrontStudioPreviewViewport title={`${activeSurface.label} preview`} widthPx={activeViewport.viewportWidthPx}>
              <StorefrontStudioCanvas
                storeSlug={storeSlug}
                surface={activeSurfaceId}
                initialStorefrontData={initialStorefrontData}
                activeProductDetailHandle={activeProductDetailHandle}
                scrollTarget={previewScrollTarget}
                onNavigateSurface={(nextSurface) => {
                  if (nextSurface !== "emails") {
                    setActiveEditorTarget(nextSurface);
                  }
                  replaceStudioUrl(nextSurface, null);
                }}
                onProductDetailChange={(productHandle) => {
                  setActiveProductDetailHandle(productHandle);
                  if (productHandle) {
                    setActiveEditorTarget("productDetail");
                    replaceStudioUrl("products", "productDetail");
                  }
                }}
              />
            </StorefrontStudioPreviewViewport>
          ) : (
            <StorefrontStudioCanvas
              storeSlug={storeSlug}
              surface={activeSurfaceId}
              initialStorefrontData={initialStorefrontData}
              activeProductDetailHandle={activeProductDetailHandle}
              scrollTarget={previewScrollTarget}
              onNavigateSurface={(nextSurface) => {
                if (nextSurface !== "emails") {
                  setActiveEditorTarget(nextSurface);
                }
                replaceStudioUrl(nextSurface, null);
              }}
              onProductDetailChange={(productHandle) => {
                setActiveProductDetailHandle(productHandle);
                if (productHandle) {
                  setActiveEditorTarget("productDetail");
                  replaceStudioUrl("products", "productDetail");
                }
              }}
            />
          )}
        </div>
      </div>
    );
  }

  function handleRailCollapsedChange(nextCollapsed: boolean) {
    writeLocalStorageFlag(STOREFRONT_STUDIO_RAIL_STORAGE_KEY, nextCollapsed);
  }

  function replaceStudioUrl(surfaceId: StorefrontStudioSurfaceId, editorTarget?: StorefrontStudioStorefrontEditorTarget | null) {
    const currentParams = new URLSearchParams(searchParams.toString());
    const currentHref = buildStorefrontStudioSurfaceHref(pathname, currentParams, normalizeStorefrontStudioSurface(currentSurfaceParam));
    const nextParams = new URLSearchParams(searchParams.toString());

    if (
      editorTarget === "brand" ||
      editorTarget === "header" ||
      editorTarget === "footer" ||
      editorTarget === "productDetail" ||
      editorTarget === "welcomePopup" ||
      editorTarget === "storeAlert"
    ) {
      nextParams.set("editor", editorTarget);
    } else {
      nextParams.delete("editor");
    }

    const nextHref = buildStorefrontStudioSurfaceHref(pathname, nextParams, surfaceId);
    if (nextHref !== currentHref) {
      router.replace(nextHref, { scroll: false });
    }
  }

  function handleSelectEditorTarget(targetId: StorefrontStudioStorefrontEditorTarget) {
    if (targetId === "productDetail") {
      const firstProduct = initialStorefrontData?.products[0] ?? null;
      const firstHandle = firstProduct?.slug?.trim() || firstProduct?.id || null;
      setActiveProductDetailHandle((current) => current ?? firstHandle);
      setActiveEditorTarget("productDetail");
      replaceStudioUrl("products", "productDetail");
      return;
    }

    if (targetId === "welcomePopup") {
      const nextSurface = (STOREFRONT_WELCOME_POPUP_SURFACES as readonly string[]).includes(activePageSurfaceId) ? activePageSurfaceId : "home";
      setActiveEditorTarget("welcomePopup");
      replaceStudioUrl(nextSurface as PageSurfaceId, "welcomePopup");
      return;
    }

    if (targetId === "storeAlert") {
      setActiveEditorTarget("storeAlert");
      replaceStudioUrl(activePageSurfaceId, "storeAlert");
      return;
    }

    if (targetId === "brand" || targetId === "header" || targetId === "footer") {
      setActiveEditorTarget(targetId);
      replaceStudioUrl(activePageSurfaceId, targetId);
      return;
    }

    setActiveEditorTarget(targetId);
    replaceStudioUrl(targetId, null);
  }

  function scrollPreviewTo(section: "header" | "footer") {
    setPreviewScrollTarget((current) => ({
      section,
      nonce: (current?.nonce ?? 0) + 1
    }));
  }

  return (
    <TooltipProvider delayDuration={150}>
      <section className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-1.5">
      <DashboardPageHeader
        title="Storefront Studio"
        description="Edit the storefront through one left rail organized by shared storefront sections and customer-facing pages."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              {viewportOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={viewport === option.id}
                  aria-label={`${option.label} preview width`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                    viewport === option.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                  onClick={() => setViewport(option.id)}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Open fullscreen preview"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => setFullscreenPreview(true)}
            >
              <Expand className="mr-1.5 h-3.5 w-3.5" />
              Full screen
            </button>
            <Link href={previewHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open preview
            </Link>
          </div>
        }
      />

      <StorefrontStudioDocumentProvider storeSlug={storeSlug} initialStorefrontData={initialStorefrontData}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
          <aside
            className={cn(
              "shrink-0 overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm transition-[width] duration-200 ease-out",
              railCollapsed ? "xl:w-[4.75rem]" : "xl:w-[23rem]"
            )}
          >
            <div className="flex h-full min-h-[32rem] flex-col">
              <div
                className={cn(
                  "border-b border-border/70 px-3 py-3",
                  railCollapsed ? "flex justify-center" : "flex items-center justify-between gap-4"
                )}
              >
                {railCollapsed ? (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Expand Studio rail"
                          className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition hover:bg-muted/40 xl:inline-flex"
                          onClick={() => handleRailCollapsedChange(false)}
                        >
                          <PanelLeftOpen className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Expand panel</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <p className="text-sm font-semibold">Control Panel</p>
                )}
                {!railCollapsed ? (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Collapse Studio rail"
                          className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition hover:bg-muted/40 xl:inline-flex"
                          onClick={() => handleRailCollapsedChange(true)}
                        >
                          <PanelLeftClose className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Collapse panel</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="space-y-3">
                  {railCollapsed ? (
                    editorTargets.map((target) => {
                      const button = (
                        <button
                          type="button"
                          aria-label={`Edit ${target.label}`}
                          aria-pressed={target.id === resolvedActiveEditorTarget}
                          onClick={() => {
                            if (target.id === "brand") {
                              handleRailCollapsedChange(false);
                              setActiveEditorTarget("brand");
                              return;
                            }

                            if (target.id === "header" || target.id === "footer") {
                              setActiveEditorTarget(target.id);
                              scrollPreviewTo(target.id);
                              return;
                            }

                            handleSelectEditorTarget(target.id as StorefrontStudioStorefrontEditorTarget);
                          }}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                            target.id === resolvedActiveEditorTarget
                              ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                              : "border-border/70 bg-background hover:border-primary/20 hover:bg-primary/5"
                          )}
                        >
                          <target.icon className="h-4 w-4 shrink-0" />
                        </button>
                      );

                      return (
                        <div key={target.id} className="flex w-full justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">{target.label}</TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })
                  ) : (
                    <>
                        <StorefrontStudioEditorTargetMenu
                          activeTargetId={resolvedActiveEditorTarget}
                          activeTargetLabel={activeEditorMeta.label}
                          activeTargetDescription={activeEditorMeta.description}
                          activeTargetIcon={activeEditorMeta.icon}
                          sections={editorTargetSections}
                          onSelect={(targetId) => {
                            const nextTarget = targetId as StorefrontStudioStorefrontEditorTarget;
                            handleSelectEditorTarget(nextTarget);
                          }}
                        />
                      <div className="py-1">
                        <StorefrontStudioStorefrontEditorPanel editorTarget={resolvedActiveEditorTarget} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl">
            {renderCanvasFrame(false)}
          </div>
        </div>

        {fullscreenPreview ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${activeSurface.label} fullscreen preview`}
            className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm"
          >
            <div className="h-full w-full">{renderCanvasFrame(true)}</div>
          </div>
        ) : null}
      </StorefrontStudioDocumentProvider>
      </section>
    </TooltipProvider>
  );
}
