const MAX_STORE_SLUG_LENGTH = 63;
const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_STORE_SLUG_LENGTH = 3;

export function normalizeStoreSlug(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.slice(0, MAX_STORE_SLUG_LENGTH).replace(/-+$/g, "");
}

export function toStoreSlug(input: string): string {
  return normalizeStoreSlug(input);
}

export function isValidStoreSlug(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized.length >= MIN_STORE_SLUG_LENGTH && normalized.length <= MAX_STORE_SLUG_LENGTH && STORE_SLUG_PATTERN.test(normalized);
}

export function withStoreSlugSuffix(baseSlug: string, suffix: number): string {
  const normalizedBase = toStoreSlug(baseSlug) || "store";
  if (suffix <= 1) {
    return normalizedBase;
  }

  const suffixText = `-${suffix}`;
  const trimmedBase = normalizedBase.slice(0, MAX_STORE_SLUG_LENGTH - suffixText.length).replace(/-+$/g, "");
  const candidateBase = trimmedBase || "store";
  return `${candidateBase}${suffixText}`;
}
