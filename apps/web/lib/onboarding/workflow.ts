export const onboardingWorkflowStepIds = [
  "logo",
  "describeStore",
  "visualDirection",
  "firstProduct",
  "review"
] as const;

export type OnboardingWorkflowStepId = (typeof onboardingWorkflowStepIds)[number];

export const onboardingSessionStatuses = [
  "in_progress",
  "generation_pending",
  "generation_running",
  "generation_failed",
  "reveal_ready",
  "completed",
  "abandoned"
] as const;

export type OnboardingSessionStatus = (typeof onboardingSessionStatuses)[number];

export const onboardingVisualDirections = [
  "minimal",
  "warm_handmade",
  "natural_wellness",
  "bold_modern",
  "premium",
  "ai_choice"
] as const;

export type OnboardingVisualDirection = (typeof onboardingVisualDirections)[number];

export const onboardingProductOptionModes = ["none", "single_axis", "two_axis"] as const;
export type OnboardingProductOptionMode = (typeof onboardingProductOptionModes)[number];

export const onboardingInventoryModes = ["in_stock", "made_to_order"] as const;
export type OnboardingInventoryMode = (typeof onboardingInventoryModes)[number];

export type OnboardingFirstProductAnswers = {
  title: string;
  description: string;
  priceDollars: string;
  optionMode: OnboardingProductOptionMode;
  inventoryMode: OnboardingInventoryMode;
};

export type OnboardingAnswers = {
  storeIdentity: {
    storeName: string;
  };
  branding: {
    logoAssetPath: string | null;
    visualDirection: OnboardingVisualDirection | null;
    visualDirectionSource: "user" | "ai" | null;
  };
  storeProfile: {
    description: string;
  };
  firstProduct: OnboardingFirstProductAnswers;
  payments: {
    connectDeferred: boolean;
  };
};

export function createDefaultOnboardingAnswers(storeName = ""): OnboardingAnswers {
  return {
    storeIdentity: {
      storeName
    },
    branding: {
      logoAssetPath: null,
      visualDirection: null,
      visualDirectionSource: null
    },
    storeProfile: {
      description: ""
    },
    firstProduct: {
      title: "",
      description: "",
      priceDollars: "",
      optionMode: "none",
      inventoryMode: "in_stock"
    },
    payments: {
      connectDeferred: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeOnboardingAnswers(input: unknown, fallbackStoreName = ""): OnboardingAnswers {
  const record = isRecord(input) ? input : {};
  const storeIdentity = isRecord(record.storeIdentity) ? record.storeIdentity : {};
  const branding = isRecord(record.branding) ? record.branding : {};
  const storeProfile = isRecord(record.storeProfile) ? record.storeProfile : {};
  const firstProduct = isRecord(record.firstProduct) ? record.firstProduct : {};

  const visualDirection = onboardingVisualDirections.includes(branding.visualDirection as OnboardingVisualDirection)
    ? (branding.visualDirection as OnboardingVisualDirection)
    : null;
  const optionMode = onboardingProductOptionModes.includes(firstProduct.optionMode as OnboardingProductOptionMode)
    ? (firstProduct.optionMode as OnboardingProductOptionMode)
    : "none";
  const inventoryMode = onboardingInventoryModes.includes(firstProduct.inventoryMode as OnboardingInventoryMode)
    ? (firstProduct.inventoryMode as OnboardingInventoryMode)
    : "in_stock";

  return {
    storeIdentity: {
      storeName: getString(storeIdentity.storeName).trim() || fallbackStoreName
    },
    branding: {
      logoAssetPath: getString(branding.logoAssetPath).trim() || null,
      visualDirection,
      visualDirectionSource:
        branding.visualDirectionSource === "user" || branding.visualDirectionSource === "ai"
          ? branding.visualDirectionSource
          : null
    },
    storeProfile: {
      description: getString(storeProfile.description).trim()
    },
    firstProduct: {
      title: getString(firstProduct.title).trim(),
      description: getString(firstProduct.description).trim(),
      priceDollars: getString(firstProduct.priceDollars).trim(),
      optionMode,
      inventoryMode
    },
    payments: {
      connectDeferred: true
    }
  };
}

export function getNextOnboardingWorkflowStep(step: OnboardingWorkflowStepId | null | undefined) {
  const index = step ? onboardingWorkflowStepIds.indexOf(step) : -1;
  if (index === -1) {
    return onboardingWorkflowStepIds[0];
  }
  return onboardingWorkflowStepIds[Math.min(index + 1, onboardingWorkflowStepIds.length - 1)] ?? onboardingWorkflowStepIds[0];
}

export function getPreviousOnboardingWorkflowStep(step: OnboardingWorkflowStepId | null | undefined) {
  const index = step ? onboardingWorkflowStepIds.indexOf(step) : 0;
  if (index <= 0) {
    return onboardingWorkflowStepIds[0];
  }
  return onboardingWorkflowStepIds[index - 1] ?? onboardingWorkflowStepIds[0];
}

export function getOnboardingWorkflowStepIndex(step: OnboardingWorkflowStepId | null | undefined) {
  const index = step ? onboardingWorkflowStepIds.indexOf(step) : -1;
  return index === -1 ? 0 : index;
}

export function isOnboardingWorkflowStepId(value: unknown): value is OnboardingWorkflowStepId {
  return typeof value === "string" && onboardingWorkflowStepIds.includes(value as OnboardingWorkflowStepId);
}

export function isOnboardingSessionStatus(value: unknown): value is OnboardingSessionStatus {
  return typeof value === "string" && onboardingSessionStatuses.includes(value as OnboardingSessionStatus);
}
