"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import { getOnboardingNextStep, getOnboardingRemainingStepIds } from "@/lib/stores/onboarding-steps";

type StoreWorkspaceOnboardingBannerProps = {
  progress: StoreOnboardingProgress;
};

export function StoreWorkspaceOnboardingBanner({ progress }: StoreWorkspaceOnboardingBannerProps) {
  const [liveProgress, setLiveProgress] = useState(progress);
  const nextStep = getOnboardingNextStep(liveProgress);
  const remainingSteps = getOnboardingRemainingStepIds(liveProgress);
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

  if (!nextStep || dismissedLocalKey === dismissKey || dismissedPersisted) {
    return null;
  }

  return (
    <section className="mx-3 mb-3 mt-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">Onboarding in progress</p>
          <p className="text-sm text-amber-900/90">
            {liveProgress.completedStepCount}/{liveProgress.totalStepCount} steps complete for {liveProgress.name}. Next: {nextStep.label}.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-900 hover:bg-amber-100 hover:text-amber-900"
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
          <Button size="sm" className="h-8">
            {nextStep.label}
          </Button>
        </Link>
      </div>
    </section>
  );
}
