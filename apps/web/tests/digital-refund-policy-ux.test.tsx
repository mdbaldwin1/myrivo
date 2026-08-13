/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { OrderRefundRequestPanel } from "@/components/dashboard/order-refund-request-panel";

afterEach(() => cleanup());

describe("digital refund policy UX", () => {
  test("makes full revocation, accessed-policy evidence, and merchant override explicit", async () => {
    const user = userEvent.setup();
    render(
      <OrderRefundRequestPanel
        orderId="order-1"
        orderTotalCents={2400}
        currency="usd"
        orderStatus="paid"
        refunds={[]}
        digitalAccess={{
          fileCount: 2,
          anyAccessed: true,
          consentVersion: "immediate-delivery-v1",
          consentAcceptedAt: "2026-08-13T12:00:00.000Z",
          licenseVersion: "personal-use-v1"
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Request refund" }));
    expect(screen.getByText(/successful full refund revokes all digital access/i)).toBeTruthy();
    expect(screen.getByText(/buyer accepted immediate-delivery-v1/i)).toBeTruthy();
    expect(screen.getByText(/downloaded digital purchases are generally final/i)).toBeTruthy();
    expect(screen.getByText(/you can still override this policy/i)).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /partial refund/i }));
    expect(screen.getByText(/partial refund preserves every digital entitlement/i)).toBeTruthy();
  });
});
