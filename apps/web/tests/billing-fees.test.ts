import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  adminFromMock.mockReset();
});

describe("billing fee engine", () => {
  test("calculates deterministic fee from bps + fixed cents", async () => {
    const { calculatePlatformFeeCents } = await import("@/lib/billing/fees");
    const fee = calculatePlatformFeeCents(12_345, {
      planKey: "starter",
      feeBps: 350,
      feeFixedCents: 30
    });

    expect(fee).toBe(462);
  });

  test("falls back to starter plan when store billing profile is missing", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_billing_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }

      if (table === "billing_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    key: "starter",
                    transaction_fee_bps: 350,
                    transaction_fee_fixed_cents: 0
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { resolveStoreFeeProfile } = await import("@/lib/billing/fees");
    const profile = await resolveStoreFeeProfile("store-1");

    expect(profile).toEqual({
      planKey: "starter",
      feeBps: 350,
      feeFixedCents: 0
    });
  });
});
