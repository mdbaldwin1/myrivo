import { cookies } from "next/headers";
import type { StoreMemberRole, StoreRecord } from "@/types/database";

export const ACTIVE_STORE_COOKIE = "myrivo_active_store_slug";

export type AccessibleStore = Pick<StoreRecord, "id" | "name" | "slug" | "status" | "stripe_account_id"> & {
  role: StoreMemberRole | "support";
};

function normalizeSlug(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveActiveStoreFromList(stores: AccessibleStore[], preferredSlug?: string | null): AccessibleStore | null {
  if (stores.length === 0) {
    return null;
  }

  const normalizedPreferredSlug = normalizeSlug(preferredSlug);
  if (normalizedPreferredSlug) {
    const preferred = stores.find((store) => store.slug === normalizedPreferredSlug);
    if (preferred) {
      return preferred;
    }
  }

  return stores[0] ?? null;
}

export async function readSelectedStoreSlugFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return normalizeSlug(cookieStore.get(ACTIVE_STORE_COOKIE)?.value);
}
