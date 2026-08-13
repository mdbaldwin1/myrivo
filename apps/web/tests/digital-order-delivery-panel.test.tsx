/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DigitalOrderDeliveryPanel } from "@/components/dashboard/digital-order-delivery-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DigitalOrderDeliveryPanel", () => {
  test("shows safe delivery, notification, access, attempt, and per-file grant state", () => {
    render(
      <DigitalOrderDeliveryPanel
        orderId="order-1"
        summary={{
          fileCount: 2,
          deliveryStatus: "failed",
          notificationStatus: "failed",
          accessStatus: "suspended",
          firstAccessedAt: "2026-08-13T12:00:00.000Z",
          lastAccessedAt: "2026-08-13T13:00:00.000Z",
          attempts: [
            { attemptNumber: 1, status: "failed", startedAt: "2026-08-13T11:00:00.000Z", finishedAt: "2026-08-13T11:01:00.000Z" }
          ],
          notificationAttempts: [
            { attemptNumber: 1, status: "failed", startedAt: "2026-08-13T11:01:00.000Z", finishedAt: "2026-08-13T11:02:00.000Z" }
          ],
          files: [
            { label: "Printable PDF", filename: "printable.pdf", format: "PDF", grantsRemaining: 4, status: "suspended" },
            { label: "Bonus image", filename: "bonus.png", format: "PNG", grantsRemaining: 5, status: "suspended" }
          ],
          activeLinkExpiresAt: "2026-08-15T11:00:00.000Z",
          activeDisputeStatus: "needs_response"
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Digital delivery" })).toBeTruthy();
    expect(screen.getByText("2 manifest files")).toBeTruthy();
    expect(screen.getByText("Delivery needs attention")).toBeTruthy();
    expect(screen.getByText("Email needs attention")).toBeTruthy();
    expect(screen.getByText("Downloads suspended during the open dispute")).toBeTruthy();
    expect(screen.getByText("4 of 5 grants remaining")).toBeTruthy();
    expect(screen.getByText("Attempt 1 · Failed")).toBeTruthy();
    expect(document.body.textContent).not.toContain("order-1");
    expect(document.body.textContent).not.toContain("Bearer");
    expect(document.body.textContent).not.toContain("storage_path");
  });

  test("reuses one idempotency key while retrying resend and rotates it after success", async () => {
    const user = userEvent.setup();
    const randomUuid = vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("018f6fc1-8adc-7f43-8000-000000000701")
      .mockReturnValueOnce("018f6fc1-8adc-7f43-8000-000000000702");
    const requestKeys: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestKeys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      const succeeds = requestKeys.length >= 2;
      return new Response(JSON.stringify(succeeds ? { queued: true } : { error: "Unable to queue a fresh link." }), {
        status: succeeds ? 202 : 503,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DigitalOrderDeliveryPanel
        orderId="99999999-9999-4999-8999-999999999999"
        summary={{
          fileCount: 1,
          deliveryStatus: "succeeded",
          notificationStatus: "succeeded",
          accessStatus: "active",
          firstAccessedAt: null,
          lastAccessedAt: null,
          attempts: [],
          notificationAttempts: [],
          files: [{ label: "Printable", filename: "print.pdf", format: "PDF", grantsRemaining: 5, status: "active" }],
          activeLinkExpiresAt: "2099-08-15T11:00:00.000Z",
          activeDisputeStatus: null
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send fresh access link" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to queue a fresh link.");
    await user.click(screen.getByRole("button", { name: "Try sending again" }));
    expect((await screen.findByRole("status")).textContent).toContain("Fresh access link queued");
    expect(requestKeys).toEqual([
      "018f6fc1-8adc-7f43-8000-000000000701",
      "018f6fc1-8adc-7f43-8000-000000000701"
    ]);
    expect(randomUuid).toHaveBeenCalledTimes(2);
  });
});
