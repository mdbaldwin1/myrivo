"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Rocket, Store } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/feedback/toast";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import { getOnboardingNextStep } from "@/lib/stores/onboarding-steps";
import { toStoreSlug } from "@/lib/stores/slug";

type BootstrapResponse = {
  store?: { id: string; name: string; slug: string };
  error?: string;
};

type StoreBootstrapFormProps = {
  existingStores: StoreOnboardingProgress[];
};

const checklistItems = [
  "Finalize your general settings and support email",
  "Review branding colors, logo, and storefront copy",
  "Add your first product and verify inventory settings",
  "Preview checkout and test one full order flow"
];

export function StoreBootstrapForm({ existingStores }: StoreBootstrapFormProps) {
  const [storeName, setStoreName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const slugPreview = toStoreSlug(storeName) || "your-store-name";
  const [launchingStoreSlug, setLaunchingStoreSlug] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = storeName.trim();
    if (trimmedName.length < 2) {
      setFieldError("Store name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    setFieldError(null);
    setError(null);

    const response = await fetch("/api/stores/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: trimmedName })
    });

    const data = (await response.json()) as BootstrapResponse;

    setLoading(false);

    if (!response.ok || !data.store) {
      setError(data.error ?? "Unable to create store");
      return;
    }

    notify.success("Store created.", {
      description: `Opening ${data.store.name}.`
    });
    router.push(`/dashboard/stores/${data.store.slug}`);
    router.refresh();
  }

  async function handleLaunchStore(storeSlug: string) {
    setLaunchingStoreSlug(storeSlug);
    const response = await fetch("/api/stores/onboarding/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: storeSlug })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setLaunchingStoreSlug(null);

    if (!response.ok || !payload.ok) {
      notify.error(payload.error ?? "Unable to launch store.");
      return;
    }

    notify.success("Store submitted for review.", {
      description: "Your storefront will go live after approval."
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Set up your store workspace</CardTitle>
            <CardDescription>Create a new store and we will route you directly into its management workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Store name" description="Public name shown on storefront pages, checkout, and receipts.">
                <Input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Sunset Mercantile"
                  value={storeName}
                  onChange={(event) => {
                    setStoreName(event.target.value);
                    if (fieldError) {
                      setFieldError(null);
                    }
                  }}
                />
              </FormField>
              <AppAlert variant="error" message={fieldError} />
              <p className="text-xs text-muted-foreground">
                Store URL preview: <span className="font-medium text-foreground">/s/{slugPreview}</span>
              </p>
              <AppAlert variant="error" message={error} />
              <Button type="submit" disabled={loading || !storeName.trim()} className="w-full sm:w-auto">
                {loading ? "Creating store..." : "Create store"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Launch checklist</CardTitle>
            <CardDescription>After creation, work through these items before sharing your storefront link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {checklistItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/docs/getting-started" target="_blank" rel="noreferrer">
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="inline-flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Open onboarding docs
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {existingStores.length > 0 ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Your existing stores</CardTitle>
            <CardDescription>Jump into any store workspace without leaving onboarding.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {existingStores.map((store) => (
                <li key={store.id}>
                  <div className="rounded-md border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/stores/${store.slug}`} className="inline-flex min-w-0 items-start gap-2">
                        <Store className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{store.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {store.role} · {store.status} · {store.completedStepCount}/{store.totalStepCount} complete
                          </span>
                        </span>
                      </Link>
                      {store.steps.launch ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span> : null}
                    </div>

                    <ul className="mt-3 space-y-1">
                      {[
                        { label: "General", completed: store.steps.profile },
                        { label: "Branding", completed: store.steps.branding },
                        { label: "First product", completed: store.steps.firstProduct },
                        { label: "Payments", completed: store.steps.payments },
                        { label: "Launch", completed: store.steps.launch }
                      ].map((step) => (
                        <li key={step.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          {step.completed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{step.label}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(() => {
                        const nextStep = getOnboardingNextStep(store);
                        if (!nextStep) return null;
                        return (
                          <Link href={nextStep.href}>
                            <Button type="button" size="sm" variant="outline">
                              {nextStep.label}
                            </Button>
                          </Link>
                        );
                      })()}
                      {store.canLaunch && store.launchReady && store.status === "draft" ? (
                        <Button type="button" size="sm" onClick={() => void handleLaunchStore(store.slug)} disabled={launchingStoreSlug === store.slug}>
                          <Rocket className="h-4 w-4" />
                          {launchingStoreSlug === store.slug ? "Submitting..." : "Submit for review"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
