"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StorefrontStudioStorefrontEditorBrandTab } from "@/components/dashboard/storefront-studio-storefront-editor-brand-tab";
import { StorefrontStudioFulfillmentSettingsPanel } from "@/components/dashboard/storefront-studio-fulfillment-settings-panel";
import { storeSettingsWorkspaceSections, type StoreSettingsSectionId } from "@/lib/store-editor/store-settings-workspace";
import type { StorefrontData } from "@/lib/storefront/runtime";
import type { StorefrontStudioSurfaceId } from "@/lib/store-editor/storefront-studio";
import { cn } from "@/lib/utils";

type StorefrontStudioSettingsPanelProps = {
  storeSlug: string;
  surface: StorefrontStudioSurfaceId;
  storefrontData: StorefrontData | null;
};

function getBuilderSectionIdsForSurface(surface: StorefrontStudioSurfaceId): StoreSettingsSectionId[] {
  switch (surface) {
    case "home":
      return ["general", "branding"];
    case "products":
      return ["branding", "general"];
    case "about":
      return ["branding", "general"];
    case "policies":
      return ["general", "shipping"];
    case "cart":
      return ["shipping", "pickup"];
    case "orderSummary":
      return ["pickup", "shipping"];
    case "emails":
      return ["general", "branding"];
    default:
      return ["general", "branding"];
  }
}

function getSectionSummary(sectionId: StoreSettingsSectionId, storefrontData: StorefrontData | null) {
  if (!storefrontData) {
    return "Storefront data unavailable.";
  }

  switch (sectionId) {
    case "general":
      return [
        storefrontData.settings?.announcement?.trim() ? "Announcement set" : "Announcement missing",
        storefrontData.settings?.support_email?.trim() ? "Support email set" : "Support email missing",
        storefrontData.settings?.seo_title?.trim() ? "SEO title set" : "SEO title missing"
      ].join(" · ");
    case "branding":
      return [
        storefrontData.branding?.logo_path ? "Logo uploaded" : "Logo missing",
        storefrontData.branding?.primary_color ? "Primary color set" : "Primary color missing",
        storefrontData.branding?.theme_json ? "Theme tokens configured" : "Theme defaults active"
      ].join(" · ");
    case "shipping":
      return [
        storefrontData.settings?.checkout_enable_flat_rate_shipping ?? true ? "Shipping enabled" : "Shipping disabled",
        storefrontData.settings?.checkout_flat_rate_shipping_label?.trim() ? "Shipping label customized" : "Default shipping label",
        storefrontData.settings?.shipping_policy?.trim() ? "Shipping policy set" : "Shipping policy missing"
      ].join(" · ");
    case "pickup":
      return [
        storefrontData.settings?.checkout_enable_local_pickup ? "Pickup enabled" : "Pickup disabled",
        storefrontData.settings?.checkout_local_pickup_label?.trim() ? "Pickup label customized" : "Default pickup label",
        storefrontData.settings?.checkout_local_pickup_fee_cents ? "Pickup fee configured" : "No pickup fee"
      ].join(" · ");
    case "domains":
      return "Customer-facing, but operational. Managed outside the builder.";
    case "team":
      return "Operational access control only.";
    case "integrations":
      return "Payments and providers stay outside the canvas.";
    default:
      return "Workspace summary.";
  }
}

export function StorefrontStudioSettingsPanel({ storeSlug, surface, storefrontData }: StorefrontStudioSettingsPanelProps) {
  const builderSections = getBuilderSectionIdsForSurface(surface)
    .map((sectionId) => storeSettingsWorkspaceSections.find((section) => section.id === sectionId))
    .filter((section): section is (typeof storeSettingsWorkspaceSections)[number] => Boolean(section));
  const inlineBuilderSections = builderSections.filter((section) =>
    ["general", "branding", "shipping", "pickup"].includes(section.id)
  );
  const linkedBuilderSections = builderSections.filter(
    (section) => !["general", "branding", "shipping", "pickup"].includes(section.id)
  );

  const operationalSections = storeSettingsWorkspaceSections.filter((section) =>
    ["domains", "team", "integrations"].includes(section.id)
  );

  return (
    <div className="space-y-4">
      {inlineBuilderSections.some((section) => section.id === "branding") ? <StorefrontStudioStorefrontEditorBrandTab /> : null}
      {inlineBuilderSections.some((section) => section.id === "shipping" || section.id === "pickup") ? (
        <StorefrontStudioFulfillmentSettingsPanel
          storeSlug={storeSlug}
          showShipping={inlineBuilderSections.some((section) => section.id === "shipping")}
          showPickup={inlineBuilderSections.some((section) => section.id === "pickup")}
        />
      ) : null}

      {linkedBuilderSections.length > 0 ? (
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Remaining storefront settings</CardTitle>
            <CardDescription>These still affect the storefront, but stay on dedicated settings pages until their Studio migration bead lands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedBuilderSections.map((section) => (
              <div key={section.id} className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{getSectionSummary(section.id, storefrontData)}</p>
                  </div>
                  <Link
                    href={`/dashboard/stores/${storeSlug}${section.href}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operational settings</CardTitle>
          <CardDescription>These stay out of the builder so storefront editing does not mix with domain, staff, and provider administration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {builderSections.some((section) => section.id === "pickup") ? (
            <div className="rounded-lg border border-dashed border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Pickup operations</p>
                  <p className="text-xs text-muted-foreground">
                    Locations, hours, blackout windows, and buyer-eligibility logic stay outside the builder.
                  </p>
                </div>
                <Link
                  href={`/dashboard/stores/${storeSlug}/store-settings/pickup`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}
                >
                  Open
                </Link>
              </div>
            </div>
          ) : null}
          {operationalSections.map((section) => (
            <div key={section.id} className="rounded-lg border border-dashed border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <Link
                  href={`/dashboard/stores/${storeSlug}${section.href}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
