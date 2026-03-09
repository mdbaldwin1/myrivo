import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const dispatchWeeklyDigestsMock = vi.fn();

vi.mock("@/lib/notifications/digest/weekly", () => ({
  dispatchWeeklyDigests: (...args: unknown[]) => dispatchWeeklyDigestsMock(...args)
}));

describe("weekly digest route auth", () => {
  beforeEach(() => {
    dispatchWeeklyDigestsMock.mockReset();
    delete process.env.NOTIFICATIONS_CRON_SECRET;
  });

  test("fails closed when cron secret is not configured", async () => {
    const route = await import("@/app/api/notifications/digest/weekly/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/digest/weekly", { method: "POST" });
    const response = await route.POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Notifications cron secret is not configured." });
    expect(dispatchWeeklyDigestsMock).not.toHaveBeenCalled();
  });

  test("rejects requests with invalid bearer token", async () => {
    process.env.NOTIFICATIONS_CRON_SECRET = "digest-secret";
    const route = await import("@/app/api/notifications/digest/weekly/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/digest/weekly", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-secret"
      }
    });
    const response = await route.POST(request);

    expect(response.status).toBe(401);
    expect(dispatchWeeklyDigestsMock).not.toHaveBeenCalled();
  });

  test("accepts requests with valid bearer token", async () => {
    process.env.NOTIFICATIONS_CRON_SECRET = "digest-secret";
    dispatchWeeklyDigestsMock.mockResolvedValue({ recipients: 4, sent: 3, failed: 1 });

    const route = await import("@/app/api/notifications/digest/weekly/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/digest/weekly", {
      method: "POST",
      headers: {
        authorization: "Bearer digest-secret"
      }
    });
    const response = await route.POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, recipients: 4, sent: 3, failed: 1 });
    expect(dispatchWeeklyDigestsMock).toHaveBeenCalledTimes(1);
  });
});
