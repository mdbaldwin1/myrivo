export function buildSearchSuffix(searchParams: Record<string, string | string[] | undefined>, omitKeys: string[] = []) {
  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (omitKeys.includes(key) || value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        nextSearchParams.append(key, entry);
      }
      continue;
    }

    nextSearchParams.set(key, value);
  }

  const query = nextSearchParams.toString();
  return query ? `?${query}` : "";
}
