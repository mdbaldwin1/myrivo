import { describe, expect, test } from "vitest";
import {
  getPublishedStoreLegalDocumentSnapshot,
  resolveStoreLegalDocument
} from "@/lib/legal/store-documents";

describe("store legal document resolution", () => {
  const store = { name: "At Home Apothecary", slug: "at-home-apothecary" };
  const settings = { support_email: "support@athomeapothecary.com" };

  test("resolves default privacy content with store variables", () => {
    const document = resolveStoreLegalDocument("privacy", store, settings, null);

    expect(document.title).toBe("Privacy Policy");
    expect(document.bodyMarkdown).toContain("At Home Apothecary");
    expect(document.bodyMarkdown).toContain("support@athomeapothecary.com");
    expect(document.bodyMarkdown).toContain("privacy questions or requests");
    expect(document.sourceMode).toBe("template");
    expect(document.publishedVersion).toBeNull();
  });

  test("applies merchant overrides and template variables", () => {
    const document = resolveStoreLegalDocument("terms", store, settings, {
      source_mode: "custom",
      template_version: "v2",
      title_override: "Store Terms",
      body_markdown: "Welcome to {storeName}. Questions? {termsContactEmail}. Laws: {governingLawRegion}. {termsAdditionalDetails}",
      variables_json: {
        termsContactEmail: "legal@athomeapothecary.com",
        governingLawRegion: "New York",
        termsAdditionalDetails: "Additional markdown."
      }
    });

    expect(document.title).toBe("Store Terms");
    expect(document.bodyMarkdown).toContain("Welcome to At Home Apothecary.");
    expect(document.bodyMarkdown).toContain("legal@athomeapothecary.com");
    expect(document.bodyMarkdown).toContain("Laws: New York.");
    expect(document.bodyMarkdown).toContain("Additional markdown.");
    expect(document.templateVersion).toBe("v2");
    expect(document.sourceMode).toBe("custom");
    expect(document.publishedVersion).toBeNull();
  });

  test("can resolve the published storefront snapshot separately from the editable draft", () => {
    const published = resolveStoreLegalDocument(
      "privacy",
      store,
      settings,
      getPublishedStoreLegalDocumentSnapshot({
        id: "privacy-1",
        store_id: "store-1",
        key: "privacy",
        source_mode: "custom",
        template_version: "v1",
        title_override: "Private draft title",
        body_markdown: "Draft body that should not be public.",
        variables_json: { privacyContactEmail: "draft@example.com" },
        published_source_mode: "template",
        published_template_version: "v2",
        published_title: "Published Privacy Policy",
        published_body_markdown: "Published body for {storeName}. Contact {privacyContactEmail}.",
        published_variables_json: { privacyContactEmail: "privacy@athomeapothecary.com" },
        published_version: 3,
        published_change_summary: "Clarified data-retention wording.",
        effective_at: "2026-03-12T15:00:00.000Z",
        published_at: "2026-03-12T14:00:00.000Z",
        published_by_user_id: "user-1",
        created_at: "2026-03-12T13:00:00.000Z",
        updated_at: "2026-03-12T13:30:00.000Z"
      })
    );

    expect(published.title).toBe("Published Privacy Policy");
    expect(published.bodyMarkdown).toContain("Published body for At Home Apothecary.");
    expect(published.bodyMarkdown).toContain("privacy@athomeapothecary.com");
    expect(published.templateVersion).toBe("v2");
    expect(published.publishedVersion).toBe(3);
    expect(published.changeSummary).toBe("Clarified data-retention wording.");
  });
});
