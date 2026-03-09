import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";

type OnboardingStepId = "profile" | "branding" | "firstProduct" | "payments" | "launch";

export type OnboardingNextStep = {
  id: OnboardingStepId;
  label: string;
  href: string;
};

export function getOnboardingRemainingStepIds(store: StoreOnboardingProgress): OnboardingStepId[] {
  const steps: Array<{ id: OnboardingStepId; completed: boolean }> = [
    { id: "profile", completed: store.steps.profile },
    { id: "branding", completed: store.steps.branding },
    { id: "firstProduct", completed: store.steps.firstProduct },
    { id: "payments", completed: store.steps.payments },
    { id: "launch", completed: store.steps.launch }
  ];
  return steps.filter((step) => !step.completed).map((step) => step.id);
}

export function getOnboardingNextStep(store: StoreOnboardingProgress): OnboardingNextStep | null {
  if (!store.canManageWorkspace) {
    return null;
  }
  if (!store.steps.profile) {
    return { id: "profile", label: "Finish general settings", href: `/dashboard/stores/${store.slug}/store-settings/general` };
  }
  if (!store.steps.branding) {
    return { id: "branding", label: "Set branding", href: `/dashboard/stores/${store.slug}/store-settings/branding` };
  }
  if (!store.steps.firstProduct) {
    return { id: "firstProduct", label: "Add first product", href: `/dashboard/stores/${store.slug}/catalog` };
  }
  if (!store.steps.payments) {
    return { id: "payments", label: "Connect payments", href: `/dashboard/stores/${store.slug}/store-settings/integrations` };
  }
  if (!store.steps.launch && store.canLaunch) {
    return { id: "launch", label: "Launch store", href: "/onboarding" };
  }
  return null;
}
