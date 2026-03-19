"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OnboardingGeneratingScreenProps = {
  storeId: string;
  storeSlug: string;
  sessionId: string;
  storeName: string;
};

const generationMessages = [
  "Collecting the strongest inputs from your setup.",
  "Shaping the first storefront direction.",
  "Drafting copy, theme, and email touchpoints.",
  "Preparing the reveal preview."
];

export function OnboardingGeneratingScreen({ storeId, storeSlug, sessionId, storeName }: OnboardingGeneratingScreenProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current < generationMessages.length - 1 ? current + 1 : current));
    }, 1500);

    async function run() {
      try {
        const response = await fetch(`/api/onboarding/session/${sessionId}/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storeId })
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to finish generation.");
        }

        router.replace(`/dashboard/stores/${storeSlug}/onboarding/reveal`);
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to finish generation.");
      } finally {
        window.clearInterval(timer);
      }
    }

    void run();

    return () => {
      window.clearInterval(timer);
    };
  }, [router, sessionId, storeId, storeSlug]);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Building the first preview for {storeName}</CardTitle>
        <CardDescription>
          We’re turning the onboarding answers into a polished first storefront draft so the reveal feels real, not empty.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{generationMessages[messageIndex]}</p>
        </div>

        <AppAlert variant="error" message={error} />

        {error ? (
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
