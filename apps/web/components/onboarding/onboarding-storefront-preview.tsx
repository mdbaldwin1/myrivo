"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewView = "desktop" | "mobile";
type PreviewRoute = "home" | "products" | "about";

type OnboardingStorefrontPreviewProps = {
  storeId: string;
  sessionId: string;
  storeSlug: string;
};

const routeOptions: Array<{ id: PreviewRoute; label: string; path: string }> = [
  { id: "home", label: "Home", path: "" },
  { id: "products", label: "Products", path: "/products" },
  { id: "about", label: "About", path: "/about" }
];

const milestoneByRoute: Record<PreviewRoute, "preview_home_viewed" | "preview_products_viewed" | "preview_about_viewed"> = {
  home: "preview_home_viewed",
  products: "preview_products_viewed",
  about: "preview_about_viewed"
};

export function OnboardingStorefrontPreview({ storeId, sessionId, storeSlug }: OnboardingStorefrontPreviewProps) {
  const [activeRoute, setActiveRoute] = useState<PreviewRoute>("home");
  const [activeView, setActiveView] = useState<PreviewView>("desktop");
  const sentMilestonesRef = useRef<Set<string>>(new Set());

  const previewHref = useMemo(() => {
    const route = routeOptions.find((option) => option.id === activeRoute) ?? routeOptions[0];
    return `/s/${storeSlug}${route?.path ?? ""}`;
  }, [activeRoute, storeSlug]);

  useEffect(() => {
    const milestone = milestoneByRoute[activeRoute];
    if (sentMilestonesRef.current.has(milestone)) {
      return;
    }

    sentMilestonesRef.current.add(milestone);
    void fetch(`/api/onboarding/session/${sessionId}/milestone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        milestone
      })
    });
  }, [activeRoute, sessionId, storeId]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Storefront preview</p>
          <p className="text-xs text-muted-foreground">A live preview of the owner-visible storefront, including the first draft product.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border/70 bg-muted/30 p-1">
            {routeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveRoute(option.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeRoute === option.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-border/70 bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setActiveView("desktop")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeView === "desktop" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setActiveView("mobile")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeView === "mobile" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>

          <Button asChild variant="outline" size="sm">
            <a href={previewHref} target="_blank" rel="noreferrer">
              Open live
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0))] p-4 md:p-5">
        <div className={`mx-auto overflow-hidden rounded-[24px] border border-border/70 bg-white shadow-xl transition-all ${
          activeView === "desktop" ? "w-full" : "max-w-[390px]"
        }`}>
          <div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <div className="ml-3 min-w-0 rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
              {previewHref}
            </div>
          </div>

          <iframe
            key={`${activeRoute}-${activeView}`}
            src={previewHref}
            title="Storefront preview"
            className={`w-full border-0 bg-white ${activeView === "desktop" ? "h-[720px]" : "h-[700px]"}`}
          />
        </div>
      </div>
    </div>
  );
}
