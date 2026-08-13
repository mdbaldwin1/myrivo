import { describe, expect, test, vi } from "vitest";
import {
  deriveDigitalAccessToken,
  hashDigitalAccessToken,
  materializeEntitlementsFromManifest,
} from "@/lib/digital-products/entitlements";
import {
  processNextDigitalDelivery,
  sanitizeDigitalDeliveryError,
  type DigitalDeliveryWorkerDependencies,
} from "@/lib/digital-products/delivery-worker";
import type { DigitalDeliveryJobClaim } from "@/lib/digital-products/delivery-jobs";

const claim: DigitalDeliveryJobClaim = {
  id: "10000000-0000-4000-8000-000000000001",
  storeId: "20000000-0000-4000-8000-000000000001",
  orderId: "30000000-0000-4000-8000-000000000001",
  manifestId: "40000000-0000-4000-8000-000000000001",
  leaseToken: "50000000-0000-4000-8000-000000000001",
  attemptNumber: 1,
  notificationSentAt: null,
};

function makeDependencies(
  overrides: Partial<DigitalDeliveryWorkerDependencies> = {},
): DigitalDeliveryWorkerDependencies {
  return {
    claimJob: vi.fn(async () => claim),
    materializeEntitlements: vi.fn(async () => ({
      accessToken: "secure-purchase-token",
      accessUrl: "https://myrivo.test/downloads/secure-purchase-token",
      accessTokenId: "60000000-0000-4000-8000-000000000001",
      entitlementCount: 2,
      expiresAt: "2026-08-15T04:00:00.000Z",
      customerEmail: "buyer@example.test",
      storeName: "Test Store",
    })),
    sendNotification: vi.fn(async () => undefined),
    markNotificationSent: vi.fn(async () => undefined),
    completeJob: vi.fn(async ({ outcome }) =>
      outcome === "succeeded"
        ? { status: "succeeded" as const, nextAttemptAt: null }
        : { status: "pending" as const, nextAttemptAt: "2026-08-13T04:01:00.000Z" },
    ),
    ...overrides,
  };
}

describe("digital delivery worker", () => {
  test("retries an email failure without changing the purchase token", async () => {
    let attempt = 0;
    const successfulNotifications: string[] = [];
    const dependencies = makeDependencies({
      claimJob: vi.fn(async () => ({ ...claim, attemptNumber: ++attempt })),
      sendNotification: vi.fn(async ({ delivery }) => {
        if (attempt === 1) {
          throw new Error("provider temporarily unavailable");
        }
        successfulNotifications.push(delivery.accessToken);
      }),
    });

    await expect(processNextDigitalDelivery(dependencies)).resolves.toMatchObject({
      status: "pending",
    });
    await expect(processNextDigitalDelivery(dependencies)).resolves.toMatchObject({
      status: "succeeded",
    });

    expect(successfulNotifications).toEqual(["secure-purchase-token"]);
  });

  test("uses one provider idempotency key when state persistence fails after email", async () => {
    let attempt = 0;
    let markAttempts = 0;
    const acceptedProviderKeys = new Set<string>();
    let deliveredMessages = 0;
    const dependencies = makeDependencies({
      claimJob: vi.fn(async () => ({ ...claim, attemptNumber: ++attempt })),
      sendNotification: vi.fn(async ({ idempotencyKey }) => {
        if (!acceptedProviderKeys.has(idempotencyKey)) {
          acceptedProviderKeys.add(idempotencyKey);
          deliveredMessages += 1;
        }
      }),
      markNotificationSent: vi.fn(async () => {
        markAttempts += 1;
        if (markAttempts === 1) {
          throw new Error("database unavailable after provider accepted message");
        }
      }),
    });

    await expect(processNextDigitalDelivery(dependencies)).resolves.toMatchObject({
      status: "pending",
    });
    await expect(processNextDigitalDelivery(dependencies)).resolves.toMatchObject({
      status: "succeeded",
    });

    expect(deliveredMessages).toBe(1);
    expect(acceptedProviderKeys).toEqual(
      new Set(["digital-delivery:10000000-0000-4000-8000-000000000001"]),
    );
  });

  test("does not send again after a successful notification was recorded", async () => {
    const dependencies = makeDependencies({
      claimJob: vi.fn(async () => ({
        ...claim,
        notificationSentAt: "2026-08-13T04:00:00.000Z",
      })),
    });

    await expect(processNextDigitalDelivery(dependencies)).resolves.toMatchObject({
      status: "succeeded",
    });

    expect(dependencies.sendNotification).not.toHaveBeenCalled();
    expect(dependencies.markNotificationSent).not.toHaveBeenCalled();
  });

  test("returns idle without attempting delivery when no job is claimable", async () => {
    const dependencies = makeDependencies({ claimJob: vi.fn(async () => null) });

    await expect(processNextDigitalDelivery(dependencies)).resolves.toEqual({
      status: "idle",
      jobId: null,
      nextAttemptAt: null,
    });
    expect(dependencies.materializeEntitlements).not.toHaveBeenCalled();
  });

  test("removes credentials, bearer links, email addresses, and excess detail from persisted errors", () => {
    const safe = sanitizeDigitalDeliveryError(
      new Error(
        "Authorization: Bearer secret-token RESEND_API_KEY=re_123 buyer@example.com https://myrivo.test/downloads/raw-token " +
          "x".repeat(700),
      ),
    );

    expect(safe.length).toBeLessThanOrEqual(500);
    expect(safe).not.toContain("secret-token");
    expect(safe).not.toContain("re_123");
    expect(safe).not.toContain("buyer@example.com");
    expect(safe).not.toContain("raw-token");
  });
});

describe("manifest entitlement materialization", () => {
  test("derives a stable opaque token without persisting the bearer value", () => {
    const input = {
      jobId: claim.id,
      nonce: "70000000-0000-4000-8000-000000000001",
      secret: "a-production-secret-that-is-at-least-thirty-two-characters",
    };

    const first = deriveDigitalAccessToken(input);
    const second = deriveDigitalAccessToken(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain(input.secret);
    expect(hashDigitalAccessToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("uses only the transactional manifest RPC and reuses its stored nonce", async () => {
    const storedNonce = "70000000-0000-4000-8000-000000000002";
    const tokenSecret = "a-production-secret-that-is-at-least-thirty-two-characters";
    const rpc = vi.fn(async () => ({
      data: {
        entitlement_count: 2,
        access_token_id: "60000000-0000-4000-8000-000000000001",
        token_derivation_nonce: storedNonce,
        token_hash: hashDigitalAccessToken(
          deriveDigitalAccessToken({ jobId: claim.id, nonce: storedNonce, secret: tokenSecret }),
        ),
        expires_at: "2026-08-15T04:00:00+00:00",
      },
      error: null,
    }));

    const result = await materializeEntitlementsFromManifest({
      job: claim,
      tokenSecret,
      client: { rpc },
      externalAppUrl: "https://myrivo.test",
    });

    expect(result).toMatchObject({
      entitlementCount: 2,
      accessTokenId: "60000000-0000-4000-8000-000000000001",
      expiresAt: "2026-08-15T04:00:00+00:00",
    });
    expect(result.accessToken).toBe(
      deriveDigitalAccessToken({ jobId: claim.id, nonce: storedNonce, secret: tokenSecret }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("treats a token digest mismatch as an operational failure", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        entitlement_count: 2,
        access_token_id: "60000000-0000-4000-8000-000000000001",
        token_derivation_nonce: "70000000-0000-4000-8000-000000000002",
        token_hash: "f".repeat(64),
        expires_at: "2026-08-15T04:00:00.000Z",
      },
      error: null,
    }));

    await expect(
      materializeEntitlementsFromManifest({
        job: claim,
        tokenSecret: "a-production-secret-that-is-at-least-thirty-two-characters",
        client: { rpc },
        externalAppUrl: "https://myrivo.test",
      }),
    ).rejects.toThrow("Digital delivery token integrity check failed");
  });
});
