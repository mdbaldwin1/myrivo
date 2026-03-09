import { describe, expect, it } from "vitest";
import { resolveShippingAuditLookupActions, resolveShippingEmailAuditAction } from "@/lib/notifications/order-emails";

describe("order email shipping audit keys", () => {
  it("uses shipped-with-tracking action when tracking is available", () => {
    expect(resolveShippingEmailAuditAction("shipped", true)).toBe("email_order_shipped_with_tracking_sent");
    expect(resolveShippingAuditLookupActions("shipped", true)).toEqual(["email_order_shipped_with_tracking_sent"]);
  });

  it("checks both shipped actions when tracking is missing", () => {
    expect(resolveShippingEmailAuditAction("shipped", false)).toBe("email_order_shipped_sent");
    expect(resolveShippingAuditLookupActions("shipped", false)).toEqual([
      "email_order_shipped_sent",
      "email_order_shipped_with_tracking_sent"
    ]);
  });

  it("uses delivered action for delivered status", () => {
    expect(resolveShippingEmailAuditAction("delivered", false)).toBe("email_order_delivered_sent");
    expect(resolveShippingAuditLookupActions("delivered", false)).toEqual(["email_order_delivered_sent"]);
  });
});
