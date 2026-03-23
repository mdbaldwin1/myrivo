"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Circle, EyeOff, Rocket } from "lucide-react";
import { useState } from "react";
import { useHasMounted } from "@/components/use-has-mounted";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import { getLaunchReadinessChecklistItems, getOnboardingNextStep } from "@/lib/stores/onboarding-steps";
import { getMerchantPrimaryLifecycleAction, getStoreLifecycleDescription } from "@/lib/stores/lifecycle";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { notify } from "@/lib/feedback/toast";
import { cn } from "@/lib/utils";

type DashboardHeaderStoreLifecycleControlsProps = {
  progress: StoreOnboardingProgress;
  mode?: "summary" | "action";
};

type StoreLifecycleActionResponse = {
  ok?: boolean;
  error?: string;
  store?: {
    id: string;
    slug: string;
    status: StoreOnboardingProgress["status"];
  };
};

export function DashboardHeaderStoreLifecycleControls({ progress, mode = "action" }: DashboardHeaderStoreLifecycleControlsProps) {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const [submitting, setSubmitting] = useState(false);
  const primaryAction = getMerchantPrimaryLifecycleAction(progress.status, progress.launchReady);
  const statusDescription = getStoreLifecycleDescription(progress.status);
  const nextStep = getOnboardingNextStep(progress);
  const shouldShowChecklist = !progress.hasLaunchedOnce && progress.completedStepCount < progress.totalStepCount && Boolean(nextStep);
  const checklistItems = getLaunchReadinessChecklistItems(progress);
  const remainingCount = checklistItems.filter((item) => !item.completed).length;
  const summaryLabel = remainingCount === 0 ? "Launch ready" : `${remainingCount} step${remainingCount === 1 ? "" : "s"} to launch`;

  async function handlePrimaryAction() {
    if (!primaryAction.action || primaryAction.disabled || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const response =
        primaryAction.action === "apply" || primaryAction.action === "resubmit"
          ? await fetch(buildStoreScopedApiPath("/api/stores/current/submit-review", progress.slug), { method: "POST" })
          : await fetch(buildStoreScopedApiPath("/api/stores/current/lifecycle", progress.slug), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: primaryAction.action })
            });
      const payload = (await response.json()) as StoreLifecycleActionResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update store lifecycle.");
      }

      if (primaryAction.action === "go_offline") {
        notify.success("Store taken offline.");
      } else if (primaryAction.action === "go_live") {
        notify.success("Store is live again.");
      } else {
        notify.success("Go-live application submitted.");
      }

      router.refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to update store lifecycle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {mode === "summary" && shouldShowChecklist && hasMounted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <span className="truncate">{summaryLabel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(90vw,24rem)]">
            <DropdownMenuLabel className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Launch readiness</p>
              <p className="text-xs font-normal text-muted-foreground">{statusDescription}</p>
              {progress.statusReasonDetail ? <p className="text-xs font-normal text-foreground">{progress.statusReasonDetail}</p> : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {checklistItems.map((item) => {
              return (
                <DropdownMenuItem key={item.id} asChild>
                  <Link href={item.href} className="flex items-start gap-2">
                    {item.completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                    <span className="space-y-0.5">
                      <span className="block">{item.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{item.description}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {mode === "action" && primaryAction.action ? (
        <Button
          type="button"
          size="sm"
          variant={primaryAction.action === "go_offline" ? "outline" : "default"}
          onClick={() => void handlePrimaryAction()}
          disabled={primaryAction.disabled || submitting}
          className={cn(primaryAction.action === "go_offline" && "border-amber-300 text-amber-800 hover:bg-amber-50")}
        >
          {primaryAction.action === "go_offline" ? <EyeOff className="mr-2 h-4 w-4" /> : null}
          {primaryAction.action === "go_live" ? <Rocket className="mr-2 h-4 w-4" /> : null}
          {primaryAction.action === "apply" || primaryAction.action === "resubmit" ? <Rocket className="mr-2 h-4 w-4" /> : null}
          {submitting
            ? "Saving..."
            : primaryAction.label}
        </Button>
      ) : null}

      {mode === "action" && !primaryAction.action ? (
        <span
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "pointer-events-none opacity-60"
          )}
        >
          {primaryAction.label}
        </span>
      ) : null}
    </>
  );
}
