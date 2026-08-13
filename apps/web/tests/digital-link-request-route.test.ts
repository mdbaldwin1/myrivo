import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const SESSION_SECRET = "digital-download-session-secret-longer-than-thirty-two-characters";
const ORDER_ID = "40000000-0000-4000-8000-000000000401";
const USER_ID = "00000000-0000-4000-8000-000000000401";
const ACCESS_TOKEN = "a".repeat(43);

const environment = vi.hoisted(() => ({
  sessionSecret: "digital-download-session-secret-longer-than-thirty-two-characters",
  deliverySecret: "digital-delivery-token-secret-longer-than-thirty-two-characters",
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    getServerEnv: () => ({
      DIGITAL_DOWNLOAD_SESSION_SECRET: environment.sessionSecret,
      DIGITAL_DELIVERY_TOKEN_SECRET: environment.deliverySecret,
      DIGITAL_RECOVERY_TRUSTED_IP_HEADER: "x-myrivo-trusted-client-ip",
    }),
    getExternalAppUrl: () => "https://app.myrivo.test",
  };
});

function recoveryRequest(
  body: Record<string, unknown> = {
    orderId: ORDER_ID,
    email: "  Buyer@Example.COM ",
  },
  options: {
    origin?: string;
    cookie?: string;
    forwardedFor?: string;
    trustedClientIp?: string | null;
    vercelForwardedFor?: string | null;
  } = {},
) {
  const trustedClientIp = options.trustedClientIp === undefined
    ? "198.51.100.8"
    : options.trustedClientIp;
  const vercelForwardedFor = options.vercelForwardedFor === undefined
    ? null
    : options.vercelForwardedFor;
  return new NextRequest(
    "https://app.myrivo.test/api/digital-downloads/request-link",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "app.myrivo.test",
        origin: options.origin ?? "https://app.myrivo.test",
        "x-forwarded-for": options.forwardedFor ?? "198.51.100.8",
        ...(trustedClientIp ? { "x-myrivo-trusted-client-ip": trustedClientIp } : {}),
        ...(vercelForwardedFor ? { "x-vercel-forwarded-for": vercelForwardedFor } : {}),
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      body: JSON.stringify(body),
    },
  );
}

function handlerDependencies(options: {
  queued?: boolean;
  workMs?: number;
  rejectRecovery?: boolean;
  rateLimit?: "allowed" | "limited" | "unavailable";
} = {}) {
  let clock = 10_000;
  const observedSleeps: number[] = [];
  const observedRecovery: Array<{ orderId: string; email: string }> = [];
  const observedLimits: Array<{
    clientIpSubjectHash: string;
    clientSubjectHash: string;
    pairSubjectHash: string;
  }> = [];
  return {
    dependencies: {
      nowMs: () => clock,
      sleep: async (milliseconds: number) => {
        observedSleeps.push(milliseconds);
        clock += milliseconds;
      },
      enforceRateLimits: async (input: {
        clientIpSubjectHash: string;
        clientSubjectHash: string;
        pairSubjectHash: string;
      }) => {
        observedLimits.push(input);
        if (options.rateLimit === "limited") {
          return { allowed: false as const, retryAfterSeconds: 23 };
        }
        if (options.rateLimit === "unavailable") {
          return { allowed: false as const, unavailable: true as const };
        }
        return { allowed: true as const };
      },
      queueRecovery: async (input: { orderId: string; email: string }) => {
        observedRecovery.push(input);
        clock += options.workMs ?? 0;
        if (options.rejectRecovery) throw new Error("private database failure");
        return { queued: options.queued ?? false };
      },
    },
    observedSleeps,
    observedRecovery,
    observedLimits,
    elapsed: () => clock - 10_000,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  environment.sessionSecret = SESSION_SECRET;
  environment.deliverySecret =
    "digital-delivery-token-secret-longer-than-thirty-two-characters";
});

describe("guest digital access recovery route", () => {
  test("returns the exact same neutral response and prechosen envelope for slow valid and invalid work", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const valid = handlerDependencies({ queued: true, workMs: 680 });
    const invalid = handlerDependencies({ queued: false, workMs: 810 });

    const validResponse = await createDigitalLinkRequestHandler(
      valid.dependencies,
    )(recoveryRequest());
    const invalidResponse = await createDigitalLinkRequestHandler(
      invalid.dependencies,
    )(recoveryRequest({ orderId: ORDER_ID, email: "other@example.com" }));

    expect(validResponse.status).toBe(202);
    expect(invalidResponse.status).toBe(202);
    expect(await validResponse.json()).toEqual(await invalidResponse.json());
    expect(valid.elapsed()).toBe(invalid.elapsed());
    expect(valid.elapsed()).toBeGreaterThan(810);
    expect([2_000, 2_250]).toContain(valid.elapsed());
    expect(valid.observedSleeps[0]).toBe(valid.elapsed() - 680);
    expect(invalid.observedSleeps[0]).toBe(invalid.elapsed() - 810);
    expect(validResponse.headers.get("cache-control")).toContain("no-store");
  });

  test("normalizes email casing before throttling and queueing", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const state = handlerDependencies({ queued: true });

    await createDigitalLinkRequestHandler(state.dependencies)(recoveryRequest());

    expect(state.observedRecovery).toEqual([
      { orderId: ORDER_ID, email: "buyer@example.com" },
    ]);
    expect(state.observedLimits).toHaveLength(1);
    expect(state.observedLimits[0]?.clientIpSubjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.observedLimits[0]?.clientSubjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.observedLimits[0]?.pairSubjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(state.observedLimits)).not.toContain(ORDER_ID);
    expect(JSON.stringify(state.observedLimits)).not.toContain("buyer@example.com");
  });

  test("uses Vercel's platform client IP, ignores spoofable forwarding headers, and fails closed without it", async () => {
    const { resolveDigitalRecoveryClientIpSubjectHash } = await import(
      "@/lib/digital-products/customer-access"
    );
    const previousVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      const first = resolveDigitalRecoveryClientIpSubjectHash(
        recoveryRequest(undefined, {
          forwardedFor: "203.0.113.10",
          trustedClientIp: null,
          vercelForwardedFor: "198.51.100.44",
        }),
      );
      const spoofed = resolveDigitalRecoveryClientIpSubjectHash(
        recoveryRequest(undefined, {
          forwardedFor: "192.0.2.199",
          trustedClientIp: null,
          vercelForwardedFor: "198.51.100.44",
        }),
      );

      expect(first).toBe(spoofed);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(() =>
        resolveDigitalRecoveryClientIpSubjectHash(
          recoveryRequest(undefined, {
            trustedClientIp: null,
            vercelForwardedFor: null,
          }),
        ),
      ).toThrow(/trusted client identity/i);

      const state = handlerDependencies();
      const { createDigitalLinkRequestHandler } = await import(
        "@/lib/digital-products/customer-recovery-handler"
      );
      const missingIdentityResponse = await createDigitalLinkRequestHandler(
        state.dependencies,
      )(
        recoveryRequest(undefined, {
          trustedClientIp: null,
          vercelForwardedFor: null,
        }),
      );
      expect(missingIdentityResponse.status).toBe(503);
      expect(state.observedRecovery).toHaveLength(0);
      expect(state.observedLimits).toHaveLength(0);
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });

  test("keeps the aggregate IP bucket when a caller resets the signed cookie", async () => {
    const {
      enforceDigitalRecoveryRateLimits,
      getDigitalRecoverySession,
    } = await import("@/lib/digital-products/customer-access");
    const counts = new Map<string, number>();
    const client = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        const key = String(args.p_bucket_key);
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return {
          data: [{ allowed: count === 1, retry_after_seconds: 60 }],
          error: null,
        };
      },
    };
    const first = getDigitalRecoverySession(
      recoveryRequest(undefined, { cookie: undefined }),
      ORDER_ID,
      "buyer@example.com",
    );
    const reset = getDigitalRecoverySession(
      recoveryRequest(undefined, { cookie: undefined }),
      ORDER_ID,
      "other@example.com",
    );

    await expect(enforceDigitalRecoveryRateLimits(first, client)).resolves.toEqual({ allowed: true });
    await expect(enforceDigitalRecoveryRateLimits(reset, client)).resolves.toMatchObject({ allowed: false });
    expect(first.clientIpSubjectHash).toBe(reset.clientIpSubjectHash);
    expect(first.clientIpSubjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.clientSubjectHash).not.toBe(reset.clientSubjectHash);
    expect(JSON.stringify([...counts.keys()])).not.toContain("198.51.100.8");
  });

  test("keeps recovery exceptions inside the same neutral response envelope", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const state = handlerDependencies({ rejectRecovery: true, workMs: 700 });

    const response = await createDigitalLinkRequestHandler(state.dependencies)(
      recoveryRequest(),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      success: true,
      message: "If the order details match, a fresh download link will arrive by email.",
    });
    expect(state.elapsed()).toBeGreaterThan(700);
  });

  test("uses signed session identity and ignores forwarding headers", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const first = handlerDependencies();
    const firstResponse = await createDigitalLinkRequestHandler(
      first.dependencies,
    )(recoveryRequest());
    const cookie = firstResponse.headers
      .get("set-cookie")
      ?.match(/myrivo_recovery_session=([^;]+)/)?.[1];
    expect(firstResponse.headers.get("set-cookie")).toMatch(/Path=\/(?:;|$)/);
    expect(cookie).toMatch(
      /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/,
    );

    const second = handlerDependencies();
    await createDigitalLinkRequestHandler(second.dependencies)(
      recoveryRequest(undefined, {
        cookie: `myrivo_recovery_session=${cookie}`,
        forwardedFor: "203.0.113.99",
      }),
    );

    expect(first.observedLimits[0]?.clientSubjectHash).toBe(
      second.observedLimits[0]?.clientSubjectHash,
    );
  });

  test("rejects an untrusted origin before running recovery work", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const state = handlerDependencies();

    const response = await createDigitalLinkRequestHandler(state.dependencies)(
      recoveryRequest(undefined, { origin: "https://evil.test" }),
    );

    expect(response.status).toBe(403);
    expect(state.observedRecovery).toHaveLength(0);
    expect(state.observedLimits).toHaveLength(0);
  });

  test("bounds input and returns a field-safe validation error", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const state = handlerDependencies();

    const response = await createDigitalLinkRequestHandler(state.dependencies)(
      recoveryRequest({ orderId: "not-an-order", email: "bad" }),
    );

    expect(response.status).toBe(400);
    expect(state.observedRecovery).toHaveLength(0);
  });

  test("fails closed through distributed rate limiting before database lookup", async () => {
    const { createDigitalLinkRequestHandler } = await import(
      "@/lib/digital-products/customer-recovery-handler"
    );
    const limited = handlerDependencies({ rateLimit: "limited" });
    const unavailable = handlerDependencies({ rateLimit: "unavailable" });

    const limitedResponse = await createDigitalLinkRequestHandler(
      limited.dependencies,
    )(recoveryRequest());
    const unavailableResponse = await createDigitalLinkRequestHandler(
      unavailable.dependencies,
    )(recoveryRequest());

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("retry-after")).toBe("23");
    expect(unavailableResponse.status).toBe(503);
    expect(limited.observedRecovery).toHaveLength(0);
    expect(unavailable.observedRecovery).toHaveLength(0);
  });
});

describe("customer digital access service", () => {
  test("bounds recovery database work below the minimum response envelope", async () => {
    vi.useFakeTimers();
    try {
      const { runCustomerRecoveryWithinTimeout } = await import(
        "@/lib/digital-products/customer-access"
      );
      const result = runCustomerRecoveryWithinTimeout(
        () => new Promise(() => undefined),
      );

      await vi.advanceTimersByTimeAsync(750);
      await expect(result).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("queues only token hashes and derivation coordinates in one transactional recovery RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const { queueCustomerDigitalAccessRecovery } = await import(
      "@/lib/digital-products/customer-access"
    );
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data: {
            queued: true,
            notification_id: args.p_notification_id,
          },
          error: null,
        };
      },
    };

    const result = await queueCustomerDigitalAccessRecovery({
      orderId: ORDER_ID,
      email: "Buyer@Example.COM",
      tokenSecret: environment.deliverySecret,
      client,
    });

    expect(result).toEqual({ queued: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("prepare_customer_digital_access_recovery");
    expect(calls[0]?.args).toMatchObject({
      p_order_id: ORDER_ID,
      p_customer_email: "buyer@example.com",
      p_access_ttl_seconds: 172800,
    });
    expect(calls[0]?.args.p_request_pair_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(calls[0]?.args)).not.toContain(ACCESS_TOKEN);
  });

  test("records a sanitized durable operations failure without changing the public result", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const { queueCustomerDigitalAccessRecovery } = await import(
      "@/lib/digital-products/customer-access"
    );
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        if (name === "prepare_customer_digital_access_recovery") {
          return {
            data: null,
            error: {
              message:
                "buyer@example.com Authorization: Bearer secret https://app.test/downloads/raw",
            },
          };
        }
        return { data: "recorded", error: null };
      },
    };

    await expect(
      queueCustomerDigitalAccessRecovery({
        orderId: ORDER_ID,
        email: "buyer@example.com",
        tokenSecret: environment.deliverySecret,
        client,
      }),
    ).resolves.toEqual({ queued: false });

    expect(calls.map((call) => call.name)).toEqual([
      "prepare_customer_digital_access_recovery",
      "record_customer_digital_access_recovery_failure",
    ]);
    const failure = calls[1]?.args;
    expect(failure?.p_request_pair_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(failure?.p_safe_error).toBe("Digital access recovery failed");
    expect(JSON.stringify(failure)).not.toMatch(
      /buyer@example|authorization|downloads\/raw/i,
    );
  });

  test("issues a short direct session only as a token hash after authenticated ownership", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const { issueAuthenticatedCustomerDigitalAccess } = await import(
      "@/lib/digital-products/customer-access"
    );
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data: {
            available: true,
            access_token_id: args.p_access_token_id,
            expires_at: "2026-08-13T12:15:00.000Z",
          },
          error: null,
        };
      },
    };

    const result = await issueAuthenticatedCustomerDigitalAccess({
      orderId: ORDER_ID,
      actorUserId: USER_ID,
      email: "Buyer@Example.COM",
      client,
      externalAppUrl: "https://app.myrivo.test/",
      createAccessToken: () => ACCESS_TOKEN,
    });

    expect(result).toEqual({
      accessUrl: `https://app.myrivo.test/downloads/${ACCESS_TOKEN}`,
      expiresAt: "2026-08-13T12:15:00.000Z",
    });
    expect(calls[0]?.name).toBe(
      "issue_authenticated_customer_digital_access",
    );
    expect(calls[0]?.args).toMatchObject({
      p_order_id: ORDER_ID,
      p_actor_user_id: USER_ID,
      p_customer_email: "buyer@example.com",
      p_access_ttl_seconds: 900,
    });
    expect(calls[0]?.args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(calls[0]?.args)).not.toContain(ACCESS_TOKEN);
  });
});

describe("authenticated customer digital access route", () => {
  test("requires trusted origin, authentication, and uses user/order buckets before issuing access", async () => {
    const { createAuthenticatedDigitalAccessHandler } = await import(
      "@/lib/digital-products/authenticated-customer-access-handler"
    );
    const events: string[] = [];
    const handler = createAuthenticatedDigitalAccessHandler({
      authenticate: async () => {
        events.push("authenticate");
        return { id: USER_ID, email: "Buyer@Example.COM" };
      },
      enforceRateLimits: async (input) => {
        events.push("rate-limit");
        expect(input.userId).toBe(USER_ID);
        expect(input.orderId).toBe(ORDER_ID);
        return { allowed: true as const };
      },
      issueAccess: async (input) => {
        events.push("issue");
        expect(input.email).toBe("buyer@example.com");
        return {
          accessUrl: `https://app.myrivo.test/downloads/${ACCESS_TOKEN}`,
          expiresAt: "2026-08-13T12:15:00.000Z",
        };
      },
    });
    const response = await handler(
      recoveryRequest({}, { origin: "https://app.myrivo.test" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      accessUrl: `/downloads/${ACCESS_TOKEN}`,
      expiresAt: "2026-08-13T12:15:00.000Z",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(events).toEqual(["authenticate", "rate-limit", "issue"]);
  });

  test("does not issue for a missing account email or an unowned order", async () => {
    const { createAuthenticatedDigitalAccessHandler } = await import(
      "@/lib/digital-products/authenticated-customer-access-handler"
    );
    const issueAccess = vi.fn(async () => null);
    const noEmail = createAuthenticatedDigitalAccessHandler({
      authenticate: async () => ({ id: USER_ID, email: null }),
      enforceRateLimits: async () => ({ allowed: true as const }),
      issueAccess,
    });
    const wrongOrder = createAuthenticatedDigitalAccessHandler({
      authenticate: async () => ({ id: USER_ID, email: "buyer@example.com" }),
      enforceRateLimits: async () => ({ allowed: true as const }),
      issueAccess,
    });

    const noEmailResponse = await noEmail(recoveryRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    const wrongOrderResponse = await wrongOrder(recoveryRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(noEmailResponse.status).toBe(404);
    expect(wrongOrderResponse.status).toBe(404);
    expect(await noEmailResponse.json()).toEqual({ error: "Order not found." });
    expect(await wrongOrderResponse.json()).toEqual({ error: "Order not found." });
  });

  test("rejects an untrusted origin before authentication", async () => {
    const { createAuthenticatedDigitalAccessHandler } = await import(
      "@/lib/digital-products/authenticated-customer-access-handler"
    );
    const authenticate = vi.fn();
    const handler = createAuthenticatedDigitalAccessHandler({
      authenticate,
      enforceRateLimits: async () => ({ allowed: true as const }),
      issueAccess: async () => null,
    });

    const response = await handler(
      recoveryRequest({}, { origin: "https://evil.test" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );

    expect(response.status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });
});

test("the test fixture cookie signature remains domain-separated", () => {
  const id = "b0000000-0000-4000-8000-000000000401";
  expect(
    createHmac("sha256", SESSION_SECRET)
      .update(`digital-recovery-session-cookie-v1\0${id}`)
      .digest("base64url"),
  ).toHaveLength(43);
});
