import { describe, expect, test, vi } from "vitest";
import {
  DIGITAL_PRODUCTS_FEATURE_KEY,
  isDigitalProductsEnabled,
  resolveStoreDigitalProductsAccess,
} from "@/lib/digital-products/feature-gating";

function buildAccessClient(input: { storeFlag?: boolean | null; error?: string }) {
  const from = vi.fn((table: string) => {
    if (table !== "store_feature_flags") {
      throw new Error(`Unexpected table ${table}`);
    }
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: input.storeFlag === undefined ? null : { digital_products: input.storeFlag },
        error: input.error ? { message: input.error } : null,
      })),
    };
    return query;
  });

  return { client: { from }, from };
}

describe("digital product rollout feature gating", () => {
  test("exposes the dedicated camel-case plan key", () => {
    expect(DIGITAL_PRODUCTS_FEATURE_KEY).toBe("digitalProducts");
  });

  test("treats a store as enabled unless it has explicitly opted out", () => {
    expect(isDigitalProductsEnabled({ digital_products: true })).toBe(true);
    expect(isDigitalProductsEnabled(undefined)).toBe(true);
    expect(isDigitalProductsEnabled(null)).toBe(true);
    expect(isDigitalProductsEnabled({})).toBe(true);
    expect(isDigitalProductsEnabled({ digital_products: false })).toBe(false);
  });

  test("enables a store that has no rollout row yet", async () => {
    const { client } = buildAccessClient({});
    await expect(
      resolveStoreDigitalProductsAccess(client, "10000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual({ enabled: true, planEligible: true, storeEnabled: true, planKey: null });
  });

  test("disables only a store whose flag is explicitly false", async () => {
    const { client } = buildAccessClient({ storeFlag: false });
    await expect(
      resolveStoreDigitalProductsAccess(client, "10000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual({ enabled: false, planEligible: true, storeEnabled: false, planKey: null });
  });

  test("does not consult billing plans", async () => {
    const { client, from } = buildAccessClient({ storeFlag: true });
    await resolveStoreDigitalProductsAccess(client, "10000000-0000-4000-8000-000000000001");
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("store_feature_flags");
  });

  test("surfaces a configuration read failure rather than guessing", async () => {
    const { client } = buildAccessClient({ error: "rollout lookup failed" });
    await expect(
      resolveStoreDigitalProductsAccess(client, "10000000-0000-4000-8000-000000000001"),
    ).rejects.toThrow(/rollout lookup failed/i);
  });
});
