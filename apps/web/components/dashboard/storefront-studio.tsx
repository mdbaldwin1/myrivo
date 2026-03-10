"use client";

import Link from "next/link";
import { LayoutPanelLeft, Monitor, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentWorkspaceAboutForm } from "@/components/dashboard/content-workspace-about-form";
import { ContentWorkspaceCartForm } from "@/components/dashboard/content-workspace-cart-form";
import { ContentWorkspaceEmailsForm } from "@/components/dashboard/content-workspace-emails-form";
import { ContentWorkspaceHomeForm } from "@/components/dashboard/content-workspace-home-form";
import { ContentWorkspaceOrderSummaryForm } from "@/components/dashboard/content-workspace-order-summary-form";
import { ContentWorkspacePoliciesForm } from "@/components/dashboard/content-workspace-policies-form";
import { ContentWorkspaceProductsForm } from "@/components/dashboard/content-workspace-products-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getStorefrontStudioSurface,
  normalizeStorefrontStudioSurface,
  storefrontStudioSurfaces,
  type StorefrontStudioSurfaceId
} from "@/lib/store-editor/storefront-studio";

type StorefrontStudioProps = {
  storeSlug: string;
  initialSurface?: string | null;
};

function renderSurfaceEditor(surface: StorefrontStudioSurfaceId) {
  switch (surface) {
    case "home":
      return <ContentWorkspaceHomeForm />;
    case "products":
      return <ContentWorkspaceProductsForm />;
    case "about":
      return <ContentWorkspaceAboutForm />;
    case "policies":
      return <ContentWorkspacePoliciesForm />;
    case "cart":
      return <ContentWorkspaceCartForm />;
    case "orderSummary":
      return <ContentWorkspaceOrderSummaryForm />;
    case "emails":
      return <ContentWorkspaceEmailsForm />;
    default:
      return <ContentWorkspaceHomeForm />;
  }
}

export function StorefrontStudio({ storeSlug, initialSurface }: StorefrontStudioProps) {
  const router = useRouter();
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const activeSurfaceId = normalizeStorefrontStudioSurface(initialSurface);
  const activeSurface = useMemo(() => getStorefrontStudioSurface(activeSurfaceId), [activeSurfaceId]);
  const previewHref = activeSurface.previewHref(storeSlug);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
      <DashboardPageHeader
        title="Storefront Studio"
        description="Edit a storefront surface, preview the live route beside it, and keep navigation/context in one place instead of bouncing between separate pages."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                  viewport === "desktop" ? "bg-foreground text-background" : "text-muted-foreground"
                )}
                onClick={() => setViewport("desktop")}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition",
                  viewport === "mobile" ? "bg-foreground text-background" : "text-muted-foreground"
                )}
                onClick={() => setViewport("mobile")}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
            <Link href={previewHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open preview
            </Link>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_28rem]">
        <div className="space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutPanelLeft className="h-5 w-5 text-muted-foreground" />
                Surface navigator
              </CardTitle>
              <CardDescription>Switch surfaces without leaving the Studio shell.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {storefrontStudioSurfaces.map((surface) => (
                <button
                  key={surface.id}
                  type="button"
                  onClick={() => router.replace(`/dashboard/stores/${storeSlug}/content-workspace?surface=${surface.id}`, { scroll: false })}
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left transition",
                    surface.id === activeSurfaceId
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-background hover:border-foreground/30 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <surface.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{surface.label}</p>
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          surface.id === activeSurfaceId ? "text-background/80" : "text-muted-foreground"
                        )}
                      >
                        {surface.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">Studio guidance</CardTitle>
              <CardDescription>{activeSurface.previewLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeSurface.qualityChecklist.map((item) => (
                <div key={item} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[32rem] border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">{activeSurface.label} preview</CardTitle>
            <CardDescription>{activeSurface.description}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0">
            <div className="flex h-full min-h-[28rem] items-start justify-center rounded-xl border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-4">
              <div
                className={cn(
                  "overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] transition-all",
                  viewport === "desktop" ? "h-[42rem] w-full max-w-5xl rounded-[1rem]" : "h-[42rem] w-[23rem]"
                )}
              >
                <iframe title={`${activeSurface.label} preview`} src={previewHref} className="h-full w-full bg-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[32rem] border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">{activeSurface.label} inspector</CardTitle>
            <CardDescription>Inline controls stay in Studio; the save bar for each surface remains inside the inspector.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 p-0">
            <div className="h-[42rem] min-h-0 overflow-hidden rounded-b-lg">{renderSurfaceEditor(activeSurfaceId)}</div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
