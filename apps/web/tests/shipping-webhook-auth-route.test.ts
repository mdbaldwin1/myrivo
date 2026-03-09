import { beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

const getShippingEnvMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const sendOrderShippingNotificationMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getShippingEnv: (...args: unknown[]) => getShippingEnvMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: (...args: unknown[]) => createSupabaseAdminClientMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderShippingNotification: (...args: unknown[]) => sendOrderShippingNotificationMock(...args)
}));

beforeEach(() => {
  getShippingEnvMock.mockReset();
  createSupabaseAdminClientMock.mockReset();
  sendOrderShippingNotificationMock.mockReset();

  getShippingEnvMock.mockReturnValue({
    SHIPPING_PROVIDER: "easypost",
    EASYPOST_API_KEY: "ep_key",
    SHIPPING_WEBHOOK_SECRET: "env-secret",
    SHIPPING_ALLOW_QUERY_TOKEN: undefined,
    SHIPPING_WEBHOOK_SIGNING_SECRET: undefined,
    SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: undefined,
    SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: undefined
  });
});

describe("shipping webhook auth", () => {
  test("rejects query token by default", async () => {
    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(async () => ({ data: [], error: null }))
          }))
        }))
      }))
    });

    const route = await import("@/app/api/shipping/webhook/route");
    const request = new NextRequest("http://localhost:3000/api/shipping/webhook?token=env-secret", {
      method: "POST",
      body: JSON.stringify({})
    });
    const response = await route.POST(request);
    expect(response.status).toBe(401);
  });

  test("rejects when signature is required and missing", async () => {
    getShippingEnvMock.mockReturnValue({
      SHIPPING_PROVIDER: "easypost",
      EASYPOST_API_KEY: "ep_key",
      SHIPPING_WEBHOOK_SECRET: "env-secret",
      SHIPPING_ALLOW_QUERY_TOKEN: undefined,
      SHIPPING_WEBHOOK_SIGNING_SECRET: "signing-secret",
      SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: "true",
      SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: "300"
    });

    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(async () => ({ data: [], error: null }))
          }))
        }))
      }))
    });

    const route = await import("@/app/api/shipping/webhook/route");
    const request = new NextRequest("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: {
        "x-shipping-webhook-secret": "env-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const response = await route.POST(request);
    expect(response.status).toBe(401);
  });

  test("accepts valid signature and timestamp when configured", async () => {
    getShippingEnvMock.mockReturnValue({
      SHIPPING_PROVIDER: "easypost",
      EASYPOST_API_KEY: "ep_key",
      SHIPPING_WEBHOOK_SECRET: "env-secret",
      SHIPPING_ALLOW_QUERY_TOKEN: undefined,
      SHIPPING_WEBHOOK_SIGNING_SECRET: "signing-secret",
      SHIPPING_WEBHOOK_REQUIRE_SIGNATURE: "true",
      SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: "300"
    });

    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "store_integrations") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        };
      })
    });

    const route = await import("@/app/api/shipping/webhook/route");
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({});
    const signature = createHmac("sha256", "signing-secret")
      .update(`${nowSeconds}.${body}`)
      .digest("hex");
    const request = new NextRequest("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: {
        "x-shipping-webhook-secret": "env-secret",
        "x-shipping-timestamp": nowSeconds,
        "x-shipping-signature": `v1=${signature}`,
        "content-type": "application/json"
      },
      body
    });
    const response = await route.POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, updated: 0 });
  });

  test("accepts header secret", async () => {
    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "store_integrations") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        };
      })
    });

    const route = await import("@/app/api/shipping/webhook/route");
    const request = new NextRequest("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: {
        "x-shipping-webhook-secret": "env-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const response = await route.POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, updated: 0 });
  });
});
