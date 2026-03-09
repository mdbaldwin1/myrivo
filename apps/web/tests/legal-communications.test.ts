import { describe, expect, it } from "vitest";
import { buildLegalUpdateContent } from "@/lib/legal/communications";

describe("legal communications", () => {
  it("builds legal update notification and email content", () => {
    const content = buildLegalUpdateContent({
      documentTitle: "Terms of Service",
      documentKey: "terms",
      versionLabel: "v1.2",
      effectiveAt: "2026-03-10T00:00:00.000Z",
      actionUrl: "/legal/consent"
    });

    expect(content.title).toContain("Terms of Service");
    expect(content.body).toContain("v1.2");
    expect(content.emailSubject).toContain("v1.2");
    expect(content.emailText).toContain("/legal/consent");
  });
});
