"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/feedback/toast";
import { toStoreSlug } from "@/lib/stores/slug";

type BootstrapResponse = {
  store?: { id: string; name: string; slug: string };
  onboardingSessionId?: string;
  error?: string;
};

export function OnboardingNewStoreForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = toStoreSlug(storeName) || "your-store-name";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = storeName.trim();

    if (trimmedName.length < 2) {
      setError("Give the store a name with at least 2 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/stores/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeName: trimmedName })
    });
    const payload = (await response.json()) as BootstrapResponse;
    setLoading(false);

    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to create the store right now.");
      return;
    }

    notify.success("Store created.", {
      description: `${payload.store.name} is ready for setup.`
    });
    router.push(`/dashboard/stores/${payload.store.slug}/onboarding`);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center">
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What would you like to name your store?</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll create it right away and you can shape the rest in the next steps.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            required
            minLength={2}
            maxLength={80}
            placeholder="Sunset Mercantile"
            value={storeName}
            onChange={(event) => {
              setStoreName(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            className="h-16 rounded-2xl px-5 text-lg"
          />

          <p className="text-sm text-muted-foreground">
            Storefront URL preview: <span className="font-medium text-foreground">/s/{slugPreview}</span>
          </p>
        </div>

        <AppAlert variant="error" message={error} />

        <Button type="submit" size="lg" disabled={loading || !storeName.trim()}>
          {loading ? "Creating store..." : "Create store"}
          {!loading ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </form>
    </div>
  );
}
