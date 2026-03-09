const PRODUCT_SLUG_MAX_LENGTH = 96;

export function normalizeProductSlug(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.slice(0, PRODUCT_SLUG_MAX_LENGTH).replace(/-+$/g, "");
}

export function buildProductSlug(base: string, suffix = 1): string {
  const normalizedBase = normalizeProductSlug(base) || "product";
  if (suffix <= 1) {
    return normalizedBase;
  }

  const suffixText = `-${suffix}`;
  const trimmedBase = normalizedBase.slice(0, PRODUCT_SLUG_MAX_LENGTH - suffixText.length).replace(/-+$/g, "");
  return `${trimmedBase || "product"}${suffixText}`;
}
