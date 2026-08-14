import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const processDigitalDeliveryBatchMock = vi.fn();

vi.mock("@/lib/digital-products/delivery-worker", () => ({
  processDigitalDeliveryBatch: (...args: unknown[]) =>
    processDigitalDeliveryBatchMock(...args),
}));

describe("digital delivery process route", () => {
  beforeEach(() => {
    vi.resetModules();
    processDigitalDeliveryBatchMock.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    delete process.env.DIGITAL_DELIVERY_PROCESS_SECRET;
    delete process.env.DIGITAL_DELIVERY_TOKEN_SECRET;
  });

  test("fails closed without process credentials", async () => {
    const route = await import(
      "@/app/api/internal/digital-delivery/process/route"
    );
    const response = await route.POST(
      new NextRequest("http://localhost/api/internal/digital-delivery/process", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(processDigitalDeliveryBatchMock).not.toHaveBeenCalled();
  });

  test("rejects an invalid bearer credential without echoing it", async () => {
    process.env.DIGITAL_DELIVERY_PROCESS_SECRET =
      "correct-process-secret-that-is-long-enough";
    const route = await import(
      "@/app/api/internal/digital-delivery/process/route"
    );
    const response = await route.POST(
      new NextRequest("http://localhost/api/internal/digital-delivery/process", {
        method: "POST",
        headers: { authorization: "Bearer wrong-process-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain(
      "wrong-process-secret",
    );
    expect(processDigitalDeliveryBatchMock).not.toHaveBeenCalled();
  });

  test("runs the capability-aware worker while token derivation is unconfigured", async () => {
    process.env.DIGITAL_DELIVERY_PROCESS_SECRET =
      "correct-process-secret-that-is-long-enough";
    processDigitalDeliveryBatchMock.mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      retrying: 0,
      failed: 0,
      configurationIssues: ["digital_delivery_token_unconfigured"],
    });
    const route = await import(
      "@/app/api/internal/digital-delivery/process/route"
    );
    const response = await route.POST(
      new NextRequest("http://localhost/api/internal/digital-delivery/process", {
        method: "POST",
        headers: {
          authorization:
            "Bearer correct-process-secret-that-is-long-enough",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 0,
      succeeded: 0,
      retrying: 0,
      failed: 0,
      configurationIssues: ["digital_delivery_token_unconfigured"],
    });
    expect(processDigitalDeliveryBatchMock).toHaveBeenCalledOnce();
  });

  test("processes a bounded batch with a valid bearer credential", async () => {
    process.env.DIGITAL_DELIVERY_PROCESS_SECRET =
      "correct-process-secret-that-is-long-enough";
    process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
      "correct-token-secret-that-is-long-enough";
    processDigitalDeliveryBatchMock.mockResolvedValue({
      claimed: 2,
      succeeded: 1,
      retrying: 1,
      failed: 0,
      configurationIssues: [],
    });
    const route = await import(
      "@/app/api/internal/digital-delivery/process/route"
    );
    const response = await route.POST(
      new NextRequest("http://localhost/api/internal/digital-delivery/process", {
        method: "POST",
        headers: {
          authorization:
            "Bearer correct-process-secret-that-is-long-enough",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 2,
      succeeded: 1,
      retrying: 1,
      failed: 0,
      configurationIssues: [],
    });
    expect(processDigitalDeliveryBatchMock).toHaveBeenCalledTimes(1);
  });
});
