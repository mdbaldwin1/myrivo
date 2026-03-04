import { getServerEnv } from "@/lib/env";

const DEFAULT_SINGLE_STORE_SLUG = "at-home-apothecary";

export function getSingleStoreSlug() {
  const env = getServerEnv();
  return env.MYRIVO_SINGLE_STORE_SLUG?.trim() || DEFAULT_SINGLE_STORE_SLUG;
}

