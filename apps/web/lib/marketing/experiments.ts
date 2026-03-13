import type { MarketingExperimentAssignments, MarketingPageKey } from "@/lib/marketing/analytics";

export type MarketingExperimentDefinition = {
  key: string;
  status: "active" | "draft";
  hypothesis: string;
  pageKeys: MarketingPageKey[];
  variants: Array<{
    key: string;
    weight: number;
    payload: Record<string, string>;
  }>;
};

export const MARKETING_EXPERIMENTS: readonly MarketingExperimentDefinition[] = [
  {
    key: "homepage_primary_cta_copy",
    status: "active",
    hypothesis: "More explicit primary CTA copy on the homepage will increase signup starts.",
    pageKeys: ["home"],
    variants: [
      {
        key: "start_free",
        weight: 50,
        payload: {
          label: "Start free"
        }
      },
      {
        key: "create_account",
        weight: 50,
        payload: {
          label: "Create account"
        }
      }
    ]
  }
] as const;

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveMarketingExperimentAssignments(input: {
  pageKey: MarketingPageKey;
  sessionKey: string;
}) {
  const assignments: MarketingExperimentAssignments = {};

  for (const experiment of MARKETING_EXPERIMENTS) {
    if (experiment.status !== "active" || !experiment.pageKeys.includes(input.pageKey)) {
      continue;
    }

    const totalWeight = experiment.variants.reduce((sum, variant) => sum + Math.max(variant.weight, 0), 0);
    if (totalWeight <= 0) {
      continue;
    }

    const threshold = hashString(`${experiment.key}:${input.sessionKey}`) % totalWeight;
    let running = 0;

    for (const variant of experiment.variants) {
      running += Math.max(variant.weight, 0);
      if (threshold < running) {
        assignments[experiment.key] = variant.key;
        break;
      }
    }
  }

  return assignments;
}

export function getMarketingExperimentVariantPayload(input: {
  experimentKey: string;
  variantKey: string | null | undefined;
}) {
  const experiment = MARKETING_EXPERIMENTS.find((entry) => entry.key === input.experimentKey);
  if (!experiment) {
    return null;
  }

  const variant = experiment.variants.find((entry) => entry.key === input.variantKey);
  return variant?.payload ?? null;
}
