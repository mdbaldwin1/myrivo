import { describe, expect, test, vi } from "vitest";
import { deriveDigitalAccessToken, hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { loadCheckoutDigitalAccessUrl } from "@/lib/digital-products/checkout-access";

describe("checkout digital access", () => {
  test("reconstructs only the active purchase token for the succeeded order job", async () => {
    const token = deriveDigitalAccessToken({ jobId: "11111111-1111-4111-8111-111111111111", nonce: "22222222-2222-4222-8222-222222222222", secret: "s".repeat(32) });
    const maybeSingle = vi.fn(async () => ({
      data: {
        token_derivation_nonce: "22222222-2222-4222-8222-222222222222",
        token_hash: hashDigitalAccessToken(token),
        expires_at: "2099-08-15T00:00:00.000Z"
      },
      error: null
    }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      maybeSingle
    };
    const client = { from: vi.fn(() => query) };

    await expect(loadCheckoutDigitalAccessUrl({
      client,
      orderId: "33333333-3333-4333-8333-333333333333",
      jobId: "11111111-1111-4111-8111-111111111111",
      secret: "s".repeat(32),
      now: new Date("2026-08-13T00:00:00.000Z")
    })).resolves.toBe(`/downloads#token=${token}`);
    expect(query.eq).toHaveBeenCalledWith("issuance_reason", "purchase");
    expect(query.is).toHaveBeenCalledWith("revoked_at", null);
  });

  test("fails closed for expired or integrity-invalid access", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: {
          token_derivation_nonce: "22222222-2222-4222-8222-222222222222",
          token_hash: "a".repeat(64),
          expires_at: "2026-08-12T00:00:00.000Z"
        },
        error: null
      }))
    };
    await expect(loadCheckoutDigitalAccessUrl({
      client: { from: vi.fn(() => query) },
      orderId: "33333333-3333-4333-8333-333333333333",
      jobId: "11111111-1111-4111-8111-111111111111",
      secret: "s".repeat(32),
      now: new Date("2026-08-13T00:00:00.000Z")
    })).resolves.toBeNull();
  });
});
