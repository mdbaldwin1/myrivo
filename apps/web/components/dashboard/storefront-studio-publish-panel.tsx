"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { applyStorefrontStudioDraftToRuntime } from "@/lib/storefront/draft";
import { validateStorefrontStudio } from "@/lib/storefront/studio-validation";
import { createStorefrontRuntime, type StorefrontData } from "@/lib/storefront/runtime";
import type { StorefrontStudioSurfaceId } from "@/lib/store-editor/storefront-studio";

const sectionLabels = {
  home: "Home",
  productsPage: "Products",
  aboutPage: "About",
  policiesPage: "Policies",
  cartPage: "Cart",
  orderSummaryPage: "Order summary",
  emails: "Emails"
} as const;

type StorefrontStudioPublishPanelProps = {
  storefrontData: StorefrontData | null;
  surface: StorefrontStudioSurfaceId;
};

export function StorefrontStudioPublishPanel({ storefrontData, surface }: StorefrontStudioPublishPanelProps) {
  const document = useOptionalStorefrontStudioDocument();
  const [savingAll, setSavingAll] = useState(false);

  const issues = useMemo(() => {
    if (!storefrontData || !document) {
      return [];
    }

    const runtime = applyStorefrontStudioDraftToRuntime(
      createStorefrontRuntime({
        ...storefrontData,
        mode: "studio",
        surface:
          surface === "products"
            ? "products"
            : surface === "about"
              ? "about"
              : surface === "policies"
                ? "policies"
                : surface === "cart"
                  ? "cart"
                  : surface === "orderSummary"
                    ? "checkout"
                    : "home"
      }),
      document.draft
    );

    return validateStorefrontStudio(runtime);
  }, [document, storefrontData, surface]);

  async function handleSaveAll() {
    if (!document) {
      return;
    }

    setSavingAll(true);
    try {
      await document.saveDirtySections();
    } finally {
      setSavingAll(false);
    }
  }

  const dirtySections = document?.dirtySections ?? [];

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Change summary</CardTitle>
        <CardDescription>Studio saves section changes directly to the live storefront. Review unsaved sections and warnings before applying them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unsaved sections</p>
          {dirtySections.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dirtySections.map((section) => (
                <span key={section} className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium">
                  {sectionLabels[section]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No unsaved section changes.</p>
          )}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={() => void handleSaveAll()} disabled={savingAll || dirtySections.length === 0}>
          {savingAll ? "Saving changed sections..." : dirtySections.length > 0 ? "Save all changed sections" : "All changes saved"}
        </Button>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Validation</p>
          {issues.length > 0 ? (
            issues.map((issue) => (
              <div key={issue.id} className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {issue.message}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No storefront warnings in the current Studio draft.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
