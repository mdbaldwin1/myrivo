import { createHash } from "node:crypto";

type CheckoutAttemptIdentityInput = {
  checkoutAttemptId?: string;
  storeId: string;
  customerEmail: string;
  sourceCartId: string | null;
  intent: Record<string, unknown>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }

  return value;
}

function normalizeCheckoutIntent(intent: Record<string, unknown>) {
  const rawItems = Array.isArray(intent.items) ? intent.items : null;
  if (!rawItems) {
    return intent;
  }

  const itemsBySelection = new Map<string, Record<string, unknown>>();
  for (const rawItem of rawItems) {
    const item = rawItem as Record<string, unknown>;
    const key = `${String(item.productId ?? "")}::${String(item.variantId ?? "")}`;
    const existing = itemsBySelection.get(key);
    itemsBySelection.set(key, {
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: Number(existing?.quantity ?? 0) + Number(item.quantity ?? 0)
    });
  }
  const normalizedItems = [...itemsBySelection.values()]
    .map((item) => canonicalize(item))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  return {
    ...intent,
    items: normalizedItems
  };
}

export function resolveCheckoutAttemptIdentity({
  checkoutAttemptId,
  storeId,
  customerEmail,
  sourceCartId,
  intent
}: CheckoutAttemptIdentityInput) {
  const canonicalRequest = JSON.stringify(
    canonicalize({
      storeId,
      customerEmail: customerEmail.trim().toLowerCase(),
      sourceCartId,
      intent: normalizeCheckoutIntent(intent)
    })
  );
  const fingerprintSha256 = createHash("sha256").update(canonicalRequest, "utf8").digest("hex");

  return {
    attemptKey: checkoutAttemptId ?? `legacy:${fingerprintSha256}`,
    fingerprintSha256
  };
}
