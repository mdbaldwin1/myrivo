export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge(left: Record<string, unknown>, right: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const current = merged[key];
    if (isRecord(current) && isRecord(value)) {
      merged[key] = deepMerge(current, value);
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

export function mergeStorefrontCopy(
  base: Record<string, unknown>,
  sectionCopies: Array<Record<string, unknown> | null | undefined>
) {
  return sectionCopies.reduce<Record<string, unknown>>((current, sectionCopy) => {
    if (!sectionCopy) {
      return current;
    }
    return deepMerge(current, sectionCopy);
  }, base);
}

