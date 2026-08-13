import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const serverClientMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const queueResendMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverClientMock(),
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args),
}));

vi.mock("@/lib/digital-products/delivery-email", () => ({
  queueMerchantDigitalDeliveryResend: (...args: unknown[]) => queueResendMock(...args),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DIGITAL_DELIVERY_TOKEN_SECRET:
      "a-digital-delivery-secret-with-more-than-thirty-two-characters",
  }),
}));

const orderId = "10000000-0000-4000-8000-000000000301";

function request(options?: { origin?: string; idempotencyKey?: string }) {
  return new NextRequest(`https://app.myrivo.test/api/orders/${orderId}/digital-delivery/resend`, {
    method: "POST",
    headers: {
      host: "app.myrivo.test",
      origin: options?.origin ?? "https://app.myrivo.test",
      ...(options?.idempotencyKey === undefined
        ? { "idempotency-key": "merchant-resend-click-1" }
        : options.idempotencyKey
          ? { "idempotency-key": options.idempotencyKey }
          : {}),
    },
  });
}

beforeEach(() => {
  serverClientMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  queueResendMock.mockReset();
  serverClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  });
  getOwnedStoreBundleMock.mockResolvedValue({
    store: { id: "20000000-0000-4000-8000-000000000301" },
  });
  queueResendMock.mockResolvedValue({
    ok: true,
    status: "queued",
    duplicate: false,
    notificationId: "30000000-0000-4000-8000-000000000301",
  });
});

describe("merchant digital delivery resend route", () => {
  test("rejects an untrusted mutation origin before authentication", async () => {
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request({ origin: "https://evil.test" }), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(403);
    expect(serverClientMock).not.toHaveBeenCalled();
  });

  test("requires an authenticated merchant", async () => {
    serverClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(401);
    expect(queueResendMock).not.toHaveBeenCalled();
  });

  test("requires a bounded idempotency key", async () => {
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request({ idempotencyKey: "" }), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(400);
    expect(queueResendMock).not.toHaveBeenCalled();
  });

  test("queues one audited resend without returning a bearer link", async () => {
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ status: "queued", duplicate: false });
    expect(JSON.stringify(body)).not.toMatch(/token|downloads\//i);
    expect(queueResendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        storeId: "20000000-0000-4000-8000-000000000301",
        actorUserId: "user-1",
        idempotencyKey: "merchant-resend-click-1",
      }),
    );
  });

  test("returns the same accepted response for a concurrent duplicate", async () => {
    queueResendMock.mockResolvedValue({
      ok: true,
      status: "queued",
      duplicate: true,
      notificationId: "30000000-0000-4000-8000-000000000301",
    });
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      status: "queued",
      duplicate: true,
    });
  });

  test("rejects revoked, fully refunded, disputed, or otherwise ineligible access", async () => {
    queueResendMock.mockResolvedValue({ ok: false, reason: "ineligible" });
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Digital delivery is not eligible for resend.",
    });
  });

  test("uses a neutral not-found response for another store's order", async () => {
    queueResendMock.mockResolvedValue({ ok: false, reason: "not_found" });
    const { POST } = await import(
      "@/app/api/orders/[orderId]/digital-delivery/resend/route"
    );
    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order not found." });
  });
});
