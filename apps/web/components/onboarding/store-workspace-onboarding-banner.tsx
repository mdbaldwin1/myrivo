"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import { getLaunchReadinessChecklistItems, getOnboardingNextStep, getOnboardingRemainingStepIds } from "@/lib/stores/onboarding-steps";

type StoreWorkspaceOnboardingBannerProps = {
  progress: StoreOnboardingProgress;
};

export function StoreWorkspaceOnboardingBanner({ progress }: StoreWorkspaceOnboardingBannerProps) {
  const [liveProgress, setLiveProgress] = useState(progress);
  const nextStep = getOnboardingNextStep(liveProgress);
  const remainingSteps = getOnboardingRemainingStepIds(liveProgress);
  const readinessItems = getLaunchReadinessChecklistItems(liveProgress);
  const remainingReadinessCount = readinessItems.filter((item) => !item.completed).length;
  const dismissKey = useMemo(
    () => `myrivo:onboarding-banner:${liveProgress.slug}:${remainingSteps.join(",")}`,
    [liveProgress.slug, remainingSteps]
  );
  const [dismissedLocalKey, setDismissedLocalKey] = useState<string | null>(null);

  let dismissedPersisted = false;
  if (typeof window !== "undefined") {
    try {
      dismissedPersisted = window.localStorage.getItem(dismissKey) === "1";
    } catch {
      dismissedPersisted = false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshProgress() {
      const response = await fetch(`/api/stores/onboarding/progress?slug=${encodeURIComponent(liveProgress.slug)}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { progress?: StoreOnboardingProgress };
      if (cancelled || !payload.progress) {
        return;
      }
      setLiveProgress(payload.progress);
    }

    const intervalId = window.setInterval(() => {
      void refreshProgress();
    }, 3500);

    void refreshProgress();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [liveProgress.slug]);

  if (liveProgress.hasLaunchedOnce || !nextStep || dismissedLocalKey === dismissKey || dismissedPersisted) {
    return null;
  }

  return (
    <section className="mx-3 mb-0 mt-3 rounded-lg border border-[hsl(var(--brand-secondary))]/20 bg-gradient-to-r from-[hsl(var(--brand-secondary-soft))]/95 via-background to-primary/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--brand-secondary))]">Preview ready. Next comes launch readiness.</p>
          <p className="text-sm text-foreground/80">
            {liveProgress.name} has a seeded storefront preview. {remainingReadinessCount} step{remainingReadinessCount === 1 ? "" : "s"} left before launch.
            {" "}Next up: {nextStep.label}.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[hsl(var(--brand-secondary))] hover:bg-[hsl(var(--brand-secondary-soft))] hover:text-[hsl(var(--brand-secondary))]"
          aria-label="Dismiss onboarding banner"
          onClick={() => {
            setDismissedLocalKey(dismissKey);
            try {
              window.localStorage.setItem(dismissKey, "1");
            } catch {}
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2">
        <Link href={nextStep.href}>
          <Button size="sm" variant="brand" className="h-8">
            {nextStep.label}
          </Button>
        </Link>
      </div>
    </section>
  );
}
