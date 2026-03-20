import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";

type OnboardingStepId = "profile" | "branding" | "firstProduct" | "payments" | "launch";
type LaunchReadinessStepId = "details" | "firstProduct" | "payments" | "launch";

export type OnboardingNextStep = {
  id: OnboardingStepId;
  label: string;
  href: string;
};

export type LaunchReadinessChecklistItem = {
  id: LaunchReadinessStepId;
  label: string;
  description: string;
  href: string;
  completed: boolean;
};

function getDetailsHref(store: StoreOnboardingProgress): string {
  if (!store.steps.profile) {
    return `/dashboard/stores/${store.slug}/store-settings/general`;
  }

  return `/dashboard/stores/${store.slug}/storefront-studio?editor=brand`;
}

function getPaymentsStepLabel(store: StoreOnboardingProgress) {
  if (store.paymentStatus === "ready") {
    return "Payments ready";
  }

  if (store.paymentStatus === "setup_required") {
    return "Finish Stripe setup";
  }

  return "Connect payments";
}

function getPaymentsStepDescription(store: StoreOnboardingProgress) {
  if (store.paymentStatus === "ready") {
    return "Stripe, payouts, and tax setup are ready for launch.";
  }

  if (store.paymentStatus === "setup_required") {
    return "Stripe is connected, but live checkout still needs payouts or tax setup completed.";
  }

  return "Connect Stripe before you apply to launch.";
}

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

export function getLaunchReadinessChecklistItems(store: StoreOnboardingProgress): LaunchReadinessChecklistItem[] {
  const detailsComplete = store.steps.profile && store.steps.branding;
  const items: LaunchReadinessChecklistItem[] = [
    {
      id: "details",
      label: "Review store details",
      description: "Confirm your general settings, support info, and storefront basics.",
      href: getDetailsHref(store),
      completed: detailsComplete
    },
    {
      id: "firstProduct",
      label: store.steps.firstProduct ? "Products seeded" : "Add your first product",
      description: "Make sure shoppers see at least one product you feel good about.",
      href: `/dashboard/stores/${store.slug}/catalog`,
      completed: store.steps.firstProduct
    },
    {
      id: "payments",
      label: getPaymentsStepLabel(store),
      description: getPaymentsStepDescription(store),
      href: `/dashboard/stores/${store.slug}/store-settings/integrations`,
      completed: store.steps.payments
    }
  ];

  if (store.canLaunch) {
    items.push({
      id: "launch",
      label: store.steps.launch ? "Store is live" : "Go live",
      description: "Use the store overview when you are ready to apply or bring the store live.",
      href: `/dashboard/stores/${store.slug}`,
      completed: store.steps.launch
    });
  }

  return items;
}

export function getOnboardingNextStep(store: StoreOnboardingProgress): OnboardingNextStep | null {
  if (!store.canManageWorkspace) {
    return null;
  }
  if (!store.steps.profile) {
    return { id: "profile", label: "Review store details", href: `/dashboard/stores/${store.slug}/store-settings/general` };
  }
  if (!store.steps.branding) {
    return { id: "branding", label: "Polish the storefront", href: `/dashboard/stores/${store.slug}/storefront-studio?editor=brand` };
  }
  if (!store.steps.firstProduct) {
    return { id: "firstProduct", label: "Add your first product", href: `/dashboard/stores/${store.slug}/catalog` };
  }
  if (!store.steps.payments) {
    return { id: "payments", label: getPaymentsStepLabel(store), href: `/dashboard/stores/${store.slug}/store-settings/integrations` };
  }
  if (!store.steps.launch && store.canLaunch) {
    if (store.status === "pending_review" || store.status === "suspended" || store.status === "removed" || store.status === "live") {
      return null;
    }

    return { id: "launch", label: "Get ready to launch", href: `/dashboard/stores/${store.slug}` };
  }
  return null;
}
