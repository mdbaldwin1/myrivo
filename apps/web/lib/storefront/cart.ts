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

