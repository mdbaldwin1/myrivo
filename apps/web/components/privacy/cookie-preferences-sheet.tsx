"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useStorefrontCookieTheme } from "@/components/privacy/use-storefront-cookie-theme";
import { getCookieInventoryByCategory } from "@/lib/privacy/cookies";
import { cn } from "@/lib/utils";

type CookiePreferencesSheetProps = {
  open: boolean;
  analyticsEnabled: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (analyticsEnabled: boolean) => void;
};

export function CookiePreferencesSheet({
  open,
  analyticsEnabled,
  onOpenChange,
  onSave
}: CookiePreferencesSheetProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftAnalyticsEnabled, setDraftAnalyticsEnabled] = useState(analyticsEnabled);
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { isStorefront, themeStyle, radiusClass, buttonRadiusClass, cardClass, sectionSpacingClass } =
    useStorefrontCookieTheme();

  const essentialEntries = getCookieInventoryByCategory("essential");
  const analyticsEntries = getCookieInventoryByCategory("analytics");
  const currentReturnTo = (() => {
    const nextSearch = searchParams?.toString();
    return nextSearch ? `${pathname ?? "/"}?${nextSearch}` : pathname ?? "/";
  })();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-cookie-preferences-sheet="true"
        side="right"
        style={themeStyle}
        className={cn(
          "w-full overflow-y-auto sm:max-w-2xl",
          isStorefront &&
            "bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)] [&>button]:focus:ring-[hsl(var(--primary))] [&>button]:focus:ring-offset-background",
          isStorefront && radiusClass === "rounded-none" && "[&>button]:rounded-none",
          isStorefront && radiusClass === "rounded-xl" && "[&>button]:rounded-xl",
          isStorefront && radiusClass === "rounded-2xl" && "[&>button]:rounded-2xl"
        )}
      >
        <SheetHeader>
          <SheetTitle>Cookie preferences</SheetTitle>
          <SheetDescription>
            Essential cookies are always on because they support sign-in, storefront operation, and remembering your cookie choices. Analytics cookies are optional.
          </SheetDescription>
        </SheetHeader>

        <div className={cn("mt-6", sectionSpacingClass)}>
          <section className={cn("space-y-3 rounded-xl border border-border/70 bg-card/50 p-4", radiusClass, cardClass)}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Essential cookies</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Required for core product behavior like authentication, storefront continuity, and saving your preferences.
                </p>
              </div>
              <Switch checked disabled className={cn(radiusClass, isStorefront && "[&>span]:rounded-[inherit]")} />
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {essentialEntries.map((entry) => (
                <li key={entry.key} className={cn("rounded-lg border border-border/60 bg-background/70 p-3", radiusClass, isStorefront && "bg-[color:var(--storefront-surface)]/80")}>
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="mt-1">{entry.purpose}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.storageType === "cookie" ? "Cookie" : "Local storage"} • {entry.duration}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className={cn("space-y-3 rounded-xl border border-border/70 bg-card/50 p-4", radiusClass, cardClass)}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Analytics cookies</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Help store owners understand traffic, product interest, and conversion performance on their storefronts.
                </p>
              </div>
              <Switch
                checked={draftAnalyticsEnabled}
                onChange={(event) => setDraftAnalyticsEnabled(event.target.checked)}
                className={cn(radiusClass, isStorefront && "[&>span]:rounded-[inherit]")}
              />
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {analyticsEntries.map((entry) => (
                <li key={entry.key} className={cn("rounded-lg border border-border/60 bg-background/70 p-3", radiusClass, isStorefront && "bg-[color:var(--storefront-surface)]/80")}>
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="mt-1">{entry.purpose}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.storageType === "cookie" ? "Cookie" : "Local storage"} • {entry.duration}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <SheetFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            className={buttonRadiusClass}
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {isMounted ? (
            <Button
              type="button"
              className={buttonRadiusClass}
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await onSave(draftAnalyticsEnabled);
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Saving..." : "Save preferences"}
            </Button>
          ) : (
            <form action="/cookies/consent" method="post">
              <input type="hidden" name="returnTo" value={currentReturnTo} />
              <input type="hidden" name="analytics" value={draftAnalyticsEnabled ? "true" : "false"} />
              <Button type="submit" className={buttonRadiusClass}>
                Save preferences
              </Button>
            </form>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
