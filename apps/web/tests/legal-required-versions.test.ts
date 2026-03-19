import { describe, expect, test } from "vitest";
import { resolveLatestRequiredPlatformLegalVersions } from "@/lib/legal/required-versions";

describe("resolveLatestRequiredPlatformLegalVersions", () => {
  test("keeps only the newest published required version for each platform document", () => {
    const resolved = resolveLatestRequiredPlatformLegalVersions([
      {
        id: "terms-v1",
        legal_document_id: "terms-doc",
        published_at: "2026-03-01T12:00:00.000Z",
        legal_documents: { key: "platform_terms", title: "Myrivo Terms and Conditions" }
      },
      {
        id: "terms-v2",
        legal_document_id: "terms-doc",
        published_at: "2026-03-15T12:00:00.000Z",
        legal_documents: { key: "platform_terms", title: "Myrivo Terms and Conditions" }
      },
      {
        id: "privacy-v1",
        legal_document_id: "privacy-doc",
        published_at: "2026-03-03T12:00:00.000Z",
        legal_documents: { key: "platform_privacy", title: "Myrivo Privacy Policy" }
      },
      {
        id: "privacy-v2",
        legal_document_id: "privacy-doc",
        published_at: "2026-03-18T12:00:00.000Z",
        legal_documents: { key: "platform_privacy", title: "Myrivo Privacy Policy" }
      }
    ]);

    expect(resolved.platform_terms?.id).toBe("terms-v2");
    expect(resolved.platform_privacy?.id).toBe("privacy-v2");
  });

  test("ignores unrelated legal document keys", () => {
    const resolved = resolveLatestRequiredPlatformLegalVersions([
      {
        id: "store-privacy-v1",
        legal_document_id: "store-privacy-doc",
        published_at: "2026-03-18T12:00:00.000Z",
        legal_documents: { key: "store_privacy_base", title: "Storefront Privacy Policy Base" }
      }
    ]);

    expect(resolved.platform_terms).toBeUndefined();
    expect(resolved.platform_privacy).toBeUndefined();
  });
});
