"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Circle, EyeOff, Rocket } from "lucide-react";
import { useState } from "react";
import { useHasMounted } from "@/components/use-has-mounted";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
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

const CHECKLIST_ITEMS: Array<{
  key: keyof StoreOnboardingProgress["steps"];
  label: string;
  href: (slug: string) => string;
}> = [
  { key: "profile", label: "Finish general settings", href: (slug) => `/dashboard/stores/${slug}/store-settings/general` },
  { key: "branding", label: "Set storefront branding", href: (slug) => `/dashboard/stores/${slug}/storefront-studio?editor=brand` },
  { key: "firstProduct", label: "Add your first product", href: (slug) => `/dashboard/stores/${slug}/catalog` },
  { key: "payments", label: "Connect payments", href: (slug) => `/dashboard/stores/${slug}/store-settings/integrations` },
  { key: "launch", label: "Go live", href: (slug) => `/dashboard/stores/${slug}` }
];

export function DashboardHeaderStoreLifecycleControls({ progress, mode = "action" }: DashboardHeaderStoreLifecycleControlsProps) {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const [submitting, setSubmitting] = useState(false);
  const primaryAction = getMerchantPrimaryLifecycleAction(progress.status, progress.launchReady);
  const summaryLabel = `${progress.completedStepCount}/${progress.totalStepCount} onboarding complete`;
  const statusDescription = getStoreLifecycleDescription(progress.status);
  const shouldShowChecklist = !progress.hasLaunchedOnce && progress.completedStepCount < progress.totalStepCount;

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
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Store launch</p>
              <p className="text-xs font-normal text-muted-foreground">{statusDescription}</p>
              {progress.statusReasonDetail ? <p className="text-xs font-normal text-foreground">{progress.statusReasonDetail}</p> : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CHECKLIST_ITEMS.map((item) => {
              const complete = progress.steps[item.key];
              return (
                <DropdownMenuItem key={item.key} asChild>
                  <Link href={item.href(progress.slug)} className="flex items-center gap-2">
                    {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span>{item.label}</span>
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
