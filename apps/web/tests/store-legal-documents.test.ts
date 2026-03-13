import { describe, expect, test } from "vitest";
import {
  getStoreLegalDocument,
  STORE_LEGAL_DOCUMENTS,
  STORE_LEGAL_INFORMATION_ARCHITECTURE
} from "@/lib/storefront/store-legal-documents";

describe("store legal document contract", () => {
  test("defines privacy and terms as formal store-level legal documents", () => {
    expect(STORE_LEGAL_DOCUMENTS.map((document) => document.key)).toEqual(["privacy", "terms"]);
    expect(getStoreLegalDocument("privacy").storefrontPath).toBe("/privacy");
    expect(getStoreLegalDocument("terms").storefrontPath).toBe("/terms");
    expect(getStoreLegalDocument("privacy").templateVariables.map((entry) => entry.key)).toEqual([
      "privacyContactEmail",
      "privacyAdditionalDetails"
    ]);
    expect(getStoreLegalDocument("terms").templateVariables.map((entry) => entry.key)).toEqual([
      "termsContactEmail",
      "governingLawRegion",
      "termsAdditionalDetails"
    ]);
  });

  test("keeps the intended ownership split explicit", () => {
    expect(STORE_LEGAL_INFORMATION_ARCHITECTURE.storefrontStudioOwns).toContain("FAQ content");
    expect(STORE_LEGAL_INFORMATION_ARCHITECTURE.storeSettingsLegalOwns).toContain("formal Privacy Policy document");
    expect(STORE_LEGAL_INFORMATION_ARCHITECTURE.nonGoals).toContain("a drag-and-drop legal page builder");
  });
});
