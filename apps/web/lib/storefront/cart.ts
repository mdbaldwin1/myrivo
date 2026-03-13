import type { StorefrontAttributionSnapshot } from "@/lib/analytics/attribution";

export const STOREFRONT_CART_STORAGE_KEY = "aha-cart:single-store";

export type StorefrontCartEntry = {
  productId: string;
  variantId: string;
  quantity: number;
};

export function readStorefrontCart(): StorefrontCartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Array<{ productId?: unknown; variantId?: unknown; quantity?: unknown }>;
    return parsed
      .filter(
        (entry): entry is { productId: string; variantId: string; quantity: number } =>
          typeof entry.productId === "string" &&
          typeof entry.variantId === "string" &&
          typeof entry.quantity === "number" &&
          Number.isFinite(entry.quantity) &&
          entry.quantity > 0
      )
      .map((entry) => ({
        productId: entry.productId,
        variantId: entry.variantId,
        quantity: Math.max(1, Math.min(99, Math.trunc(entry.quantity)))
      }));
  } catch {
    window.localStorage.removeItem(STOREFRONT_CART_STORAGE_KEY);
    return [];
  }
}

export function writeStorefrontCart(entries: StorefrontCartEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STOREFRONT_CART_STORAGE_KEY, JSON.stringify(entries));
}

export async function syncStorefrontCart(
  entries: StorefrontCartEntry[],
  storeSlug: string,
  options?: { analyticsSessionId?: string | null; attribution?: StorefrontAttributionSnapshot | null }
) {
  if (typeof window === "undefined" || !storeSlug.trim()) {
    return;
  }

  try {
    await fetch(`/api/customer/cart?store=${encodeURIComponent(storeSlug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: entries.map((entry) => ({
          productId: entry.productId,
          variantId: entry.variantId,
          quantity: entry.quantity
        })),
        analyticsSessionId: options?.analyticsSessionId ?? undefined,
        attribution: options?.attribution ?? undefined
      })
    });
  } catch {
    // Ignore sync failures here and let the local cart remain the immediate source of truth.
  }
}
