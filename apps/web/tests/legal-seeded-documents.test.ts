import { describe, expect, test } from "vitest";
import { SEEDED_LEGAL_DOCUMENTS_V1 } from "@/lib/legal/seeded-documents";

describe("seeded legal documents", () => {
  test("platform privacy baseline covers core platform privacy topics", () => {
    const markdown = SEEDED_LEGAL_DOCUMENTS_V1.platform_privacy.contentMarkdown;

    expect(markdown).toContain("## 1. Scope");
    expect(markdown).toContain("## 2. Information We Collect");
    expect(markdown).toContain("## 4. How We Use Information");
    expect(markdown).toContain("## 5. When We Share Information");
    expect(markdown).toContain("## 7. Retention");
    expect(markdown).toContain("## 8. Your Choices and Rights");
    expect(markdown).toContain("## 9. Security");
    expect(markdown).toContain("## 13. Contact");
  });

  test("platform terms baseline covers core platform commerce and governance topics", () => {
    const markdown = SEEDED_LEGAL_DOCUMENTS_V1.platform_terms.contentMarkdown;

    expect(markdown).toContain("## 1. Scope");
    expect(markdown).toContain("## 4. Merchant Responsibilities");
    expect(markdown).toContain("## 5. Shopper Transactions");
    expect(markdown).toContain("## 6. Payments, Fees, and Third-Party Services");
    expect(markdown).toContain("## 7. Acceptable Use");
    expect(markdown).toContain("## 9. Suspension and Termination");
    expect(markdown).toContain("## 11. Limitation of Liability");
    expect(markdown).toContain("## 15. Contact");
  });

  test("store privacy baseline covers storefront customer privacy expectations", () => {
    const markdown = SEEDED_LEGAL_DOCUMENTS_V1.store_privacy_base.contentMarkdown;

    expect(markdown).toContain("## 1. Scope");
    expect(markdown).toContain("## 2. Information We Collect");
    expect(markdown).toContain("## 3. How We Use Information");
    expect(markdown).toContain("## 4. How Information Is Shared");
    expect(markdown).toContain("## 6. Retention");
    expect(markdown).toContain("## 8. Your Choices and Privacy Requests");
    expect(markdown).toContain("{privacyContactEmail}");
  });

  test("store terms baseline covers storefront customer transaction expectations", () => {
    const markdown = SEEDED_LEGAL_DOCUMENTS_V1.store_terms_base.contentMarkdown;

    expect(markdown).toContain("## 1. Scope");
    expect(markdown).toContain("## 2. Orders and Acceptance");
    expect(markdown).toContain("## 3. Pricing, Taxes, and Payment");
    expect(markdown).toContain("## 4. Fulfillment, Pickup, Shipping, Returns, and Support");
    expect(markdown).toContain("## 8. Disclaimers");
    expect(markdown).toContain("## 9. Limitation of Liability");
    expect(markdown).toContain("{governingLawRegion}");
    expect(markdown).toContain("{termsContactEmail}");
  });
});
