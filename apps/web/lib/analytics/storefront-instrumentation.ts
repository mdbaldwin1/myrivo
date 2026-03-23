type AnalyticsKeyValue = string | number | boolean | null | string[];

type AnalyticsStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} | null;

type StorefrontCartAnalyticsLineItem = {
  productId: string;
  variantId: string;
  quantity: number;
  unitPriceCents: number;
};

type BuildSearchAnalyticsValueInput = {
  query: string;
  resultCount: number;
  sortMode?: string;
  availabilityFilter?: string;
  selectedFilterValuesByAxis?: Record<string, string[]>;
  view: "home" | "products";
};

type BuildCartAnalyticsValueInput = {
  items: StorefrontCartAnalyticsLineItem[];
  fulfillmentMethod?: "pickup" | "shipping";
  discountCents?: number;
  shippingCents?: number;
};

const CHECKOUT_COMPLETION_STORAGE_PREFIX = "myrivo.analytics.checkout-completed.";

function sortRecord(value: Record<string, AnalyticsKeyValue>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export function normalizeStorefrontSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildStorefrontSearchAnalyticsValue(input: BuildSearchAnalyticsValueInput) {
  const filters = Object.fromEntries(
    Object.entries(input.selectedFilterValuesByAxis ?? {})
      .filter(([, values]) => values.length > 0)
      .map(([axis, values]) => [axis, [...values].sort()])
  );

  return {
    query: normalizeStorefrontSearchQuery(input.query),
    resultCount: input.resultCount,
    sortMode: input.sortMode ?? "featured",
    availabilityFilter: input.availabilityFilter ?? "all",
    view: input.view,
    filters
  };
}

export function buildStorefrontSearchSignature(input: BuildSearchAnalyticsValueInput) {
  return JSON.stringify(buildStorefrontSearchAnalyticsValue(input));
}

export function buildStorefrontCartAnalyticsValue(input: BuildCartAnalyticsValueInput) {
  const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

  return sortRecord({
    itemCount,
    subtotalCents,
    shippingCents: input.shippingCents ?? 0,
    discountCents: input.discountCents ?? 0,
    totalCents: Math.max(0, subtotalCents - (input.discountCents ?? 0)) + (input.shippingCents ?? 0),
    fulfillmentMethod: input.fulfillmentMethod ?? null,
    productIds: [...new Set(input.items.map((item) => item.productId))].sort()
  });
}

export function buildStorefrontAddToCartValue(input: {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  source: "home" | "products" | "product_detail";
}) {
  return sortRecord({
    variantId: input.variantId,
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    source: input.source
  });
}

export function markStorefrontCheckoutCompletedTracked(orderId: string, storage?: AnalyticsStorageLike) {
  const safeStorage = storage ?? getBrowserSessionStorage();
  if (!safeStorage) {
    return true;
  }

  const key = `${CHECKOUT_COMPLETION_STORAGE_PREFIX}${orderId}`;
  if (safeStorage.getItem(key) === "1") {
    return false;
  }
  safeStorage.setItem(key, "1");
  return true;
}

export function getBrowserSessionStorage(): AnalyticsStorageLike {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}
