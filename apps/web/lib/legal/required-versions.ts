type SupportedPlatformLegalDocumentKey = "platform_terms" | "platform_privacy";

type RequiredPlatformLegalVersionRow = {
  id: string;
  legal_document_id: string;
  published_at?: string | null;
  legal_documents: { key: string; title: string } | null;
};

function normalizeSupportedKey(key: string | null | undefined): SupportedPlatformLegalDocumentKey | null {
  if (key === "platform_terms" || key === "platform_privacy") {
    return key;
  }

  return null;
}

function getRecencyValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isNewerRequiredVersion(
  candidate: RequiredPlatformLegalVersionRow,
  current: RequiredPlatformLegalVersionRow | undefined
): boolean {
  if (!current) {
    return true;
  }

  const candidatePublishedAt = getRecencyValue(candidate.published_at);
  const currentPublishedAt = getRecencyValue(current.published_at);

  if (candidatePublishedAt !== currentPublishedAt) {
    return candidatePublishedAt > currentPublishedAt;
  }

  return candidate.id > current.id;
}

export function resolveLatestRequiredPlatformLegalVersions<T extends RequiredPlatformLegalVersionRow>(rows: T[]) {
  const latestByKey: Partial<Record<SupportedPlatformLegalDocumentKey, T>> = {};

  for (const row of rows) {
    const key = normalizeSupportedKey(row.legal_documents?.key);
    if (!key) {
      continue;
    }

    if (isNewerRequiredVersion(row, latestByKey[key])) {
      latestByKey[key] = row;
    }
  }

  return latestByKey;
}
