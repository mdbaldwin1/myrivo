import { describe, expect, test } from "vitest";
import { resolveOwnerNotificationEmails } from "@/lib/notifications/order-emails";

describe("owner order email recipients", () => {
  test("includes support email, configured env recipients, and owner/admin membership emails", () => {
    const recipients = resolveOwnerNotificationEmails({
      supportEmail: "rachel@athomeapothecary.com",
      configuredOwnerEmails: ["ops@example.com"],
      membershipEmails: ["umm.hello.mike@gmail.com", "heyworlditsme@gmail.com"]
    });

    expect(recipients).toEqual([
      "rachel@athomeapothecary.com",
      "ops@example.com",
      "umm.hello.mike@gmail.com",
      "heyworlditsme@gmail.com"
    ]);
  });

  test("dedupes overlapping recipients case-insensitively", () => {
    const recipients = resolveOwnerNotificationEmails({
      supportEmail: "Rachel@AtHomeApothecary.com",
      configuredOwnerEmails: ["rachel@athomeapothecary.com"],
      membershipEmails: ["UMM.HELLO.MIKE@GMAIL.COM", "umm.hello.mike@gmail.com"]
    });

    expect(recipients).toEqual(["rachel@athomeapothecary.com", "umm.hello.mike@gmail.com"]);
  });
});
