import { describe, expect, test, vi } from "vitest";
import {
  DIGITAL_PRODUCTS_FEATURE_KEY,
  isDigitalProductsEnabled,
  resolveStoreDigitalProductsAccess,
} from "@/lib/digital-products/feature-gating";

function buildAccessClient(input: {
  storeFlag?: boolean | null;
  planFlags?: Record<string, unknown> | null;
  planActive?: boolean;
  profileExists?: boolean;
}) {
  const from = vi.fn((table: string) => {
    if (table === "store_feature_flags") {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data:
            input.storeFlag === undefined
              ? null
              : { digital_products: input.storeFlag },
          error: null,
        })),
      };
      return query;
    }

    if (table === "store_billing_profiles") {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data:
            input.profileExists === false
              ? null
              : {
                  billing_plans: {
                    key: "standard",
                    active: input.planActive ?? true,
                    feature_flags_json: input.planFlags ?? null,
                  },
                },
          error: null,
        })),
      };
      return query;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return { from };
}

describe("digital product rollout feature gating", () => {
  test("uses the dedicated camel-case plan key and defaults every missing layer off", async () => {
    expect(DIGITAL_PRODUCTS_FEATURE_KEY).toBe("digitalProducts");
    expect(isDigitalProductsEnabled(undefined, undefined)).toBe(false);
    expect(isDigitalProductsEnabled({}, { digital_products: true })).toBe(false);
    expect(
      isDigitalProductsEnabled(
        { digitalProducts: true },
        undefined,
      ),
    ).toBe(false);

    await expect(
      resolveStoreDigitalProductsAccess(
        buildAccessClient({
          storeFlag: undefined,
          planFlags: { digitalProducts: true },
        }),
        "10000000-0000-4000-8000-000000000001",
      ),
    ).resolves.toEqual({
      enabled: false,
      planEligible: true,
      storeEnabled: false,
      planKey: "standard",
    });
  });

  test("enables a store only when its plan and store rollout flag are both true", async () => {
    await expect(
      resolveStoreDigitalProductsAccess(
        buildAccessClient({
          storeFlag: true,
          planFlags: { digitalProducts: true },
        }),
        "10000000-0000-4000-8000-000000000001",
      ),
    ).resolves.toEqual({
      enabled: true,
      planEligible: true,
      storeEnabled: true,
      planKey: "standard",
    });
  });

  test("keeps an inactive billing plan disabled even when both rollout flags are true", async () => {
    await expect(
      resolveStoreDigitalProductsAccess(
        buildAccessClient({
          storeFlag: true,
          planActive: false,
          planFlags: { digitalProducts: true },
        }),
        "10000000-0000-4000-8000-000000000001",
      ),
    ).resolves.toEqual({
      enabled: false,
      planEligible: false,
      storeEnabled: true,
      planKey: "standard",
    });
  });

  test("keeps malformed and truthy non-boolean plan flags disabled", () => {
    expect(
      isDigitalProductsEnabled(
        { digitalProducts: "true" },
        { digital_products: true },
      ),
    ).toBe(false);
    expect(
      isDigitalProductsEnabled(
        { digitalProducts: true },
        { digital_products: false },
      ),
    ).toBe(false);
  });
});
