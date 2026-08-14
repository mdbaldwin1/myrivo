export type ClientCheckoutAttempt = {
  id: string;
  canonicalIntent: string;
};

type CheckoutAttemptStorage = Pick<Storage, "getItem" | "setItem">;

const checkoutAttemptIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function getOrCreateCheckoutAttempt(
  current: ClientCheckoutAttempt | null,
  intent: Record<string, unknown>,
  createId: () => string = () => crypto.randomUUID()
): ClientCheckoutAttempt {
  const canonicalIntent = JSON.stringify(canonicalize(intent));

  if (current?.canonicalIntent === canonicalIntent) {
    return current;
  }

  return {
    id: createId(),
    canonicalIntent
  };
}

export function readCheckoutAttempt(
  storage: CheckoutAttemptStorage,
  key: string
): ClientCheckoutAttempt | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as Partial<ClientCheckoutAttempt> | null;
    if (
      !value
      || typeof value.id !== "string"
      || !checkoutAttemptIdPattern.test(value.id)
      || typeof value.canonicalIntent !== "string"
      || value.canonicalIntent.length > 16_384
    ) {
      return null;
    }
    return { id: value.id, canonicalIntent: value.canonicalIntent };
  } catch {
    return null;
  }
}

export function writeCheckoutAttempt(
  storage: CheckoutAttemptStorage,
  key: string,
  attempt: ClientCheckoutAttempt
) {
  try {
    storage.setItem(key, JSON.stringify(attempt));
  } catch {
    // The in-memory attempt remains sufficient when storage is unavailable.
  }
}
