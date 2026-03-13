"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { getCookieInventoryByCategory } from "@/lib/privacy/cookies";

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
  const [draftAnalyticsEnabled, setDraftAnalyticsEnabled] = useState(analyticsEnabled);

  const essentialEntries = getCookieInventoryByCategory("essential");
  const analyticsEntries = getCookieInventoryByCategory("analytics");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Cookie preferences</SheetTitle>
          <SheetDescription>
            Essential cookies are always on because they support sign-in, storefront operation, and remembering your cookie choices. Analytics cookies are optional.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Essential cookies</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Required for core product behavior like authentication, storefront continuity, and saving your preferences.
                </p>
              </div>
              <Switch checked disabled />
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {essentialEntries.map((entry) => (
                <li key={entry.key} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="mt-1">{entry.purpose}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.storageType === "cookie" ? "Cookie" : "Local storage"} • {entry.duration}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Analytics cookies</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Help store owners understand traffic, product interest, and conversion performance on their storefronts. They stay off unless you explicitly enable them.
                </p>
              </div>
              <Switch checked={draftAnalyticsEnabled} onChange={(event) => setDraftAnalyticsEnabled(event.target.checked)} />
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {analyticsEntries.map((entry) => (
                <li key={entry.key} className="rounded-lg border border-border/60 bg-background/70 p-3">
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draftAnalyticsEnabled);
              onOpenChange(false);
            }}
          >
            Save preferences
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
