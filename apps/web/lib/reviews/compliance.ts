export type ReviewIncentiveDisclosure = {
  disclosed: boolean;
  description: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeReviewIncentiveDescription(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, 160) : null;
}

export function buildReviewComplianceMetadata(
  baseMetadata: Record<string, unknown>,
  input: {
    incentivized: boolean;
    incentiveDescription?: string | null;
  }
) {
  return {
    ...baseMetadata,
    incentive_disclosure: {
      disclosed: input.incentivized,
      description: input.incentivized ? sanitizeReviewIncentiveDescription(input.incentiveDescription) : null
    }
  };
}

export function readReviewIncentiveDisclosure(metadata: unknown): ReviewIncentiveDisclosure {
  if (!isRecord(metadata)) {
    return { disclosed: false, description: null };
  }

  const rawDisclosure = metadata.incentive_disclosure;
  if (!isRecord(rawDisclosure)) {
    return { disclosed: false, description: null };
  }

  return {
    disclosed: rawDisclosure.disclosed === true,
    description: sanitizeReviewIncentiveDescription(typeof rawDisclosure.description === "string" ? rawDisclosure.description : null)
  };
}
