"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";

type DashboardWelcomeChoiceProps = {
  hasStoreAccess: boolean;
};

async function persistWelcomeIntent(intent: "shop" | "sell") {
  const response = await fetch("/api/user/welcome-intent", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent })
  });

  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Unable to save your selection.");
  }
}

export function DashboardWelcomeChoice({ hasStoreAccess }: DashboardWelcomeChoiceProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState<"shop" | "sell" | null>(null);

  async function choose(intent: "shop" | "sell") {
    setLoadingIntent(intent);
    setError(null);

    try {
      await persistWelcomeIntent(intent);
      notify.success(intent === "sell" ? "Let’s build your store." : "Let’s start browsing.");
      router.push(intent === "sell" && !hasStoreAccess ? "/dashboard/stores/onboarding/new" : "/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue right now.");
    } finally {
      setLoadingIntent(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[68vh] max-w-5xl items-center">
      <div className="w-full space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Welcome</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Are you here to shop or sell?</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            We’ll take you to the right starting point. You can always switch directions later.
          </p>
        </div>

        <AppAlert variant="error" message={error} />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>Shop</CardTitle>
                <CardDescription>Browse saved storefront activity, open carts, and recent orders.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button type="button" className="w-full justify-between" onClick={() => void choose("shop")} disabled={loadingIntent !== null}>
                {loadingIntent === "shop" ? "Opening dashboard..." : "I’m here to shop"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                <Store className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>Sell</CardTitle>
                <CardDescription>Start the guided flow to create a store and generate your first storefront preview.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button type="button" className="w-full justify-between" onClick={() => void choose("sell")} disabled={loadingIntent !== null}>
                {loadingIntent === "sell" ? "Starting store setup..." : "I’m here to sell"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
