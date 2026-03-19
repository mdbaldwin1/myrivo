import { describe, expect, test } from "vitest";
import { getPublishedStoreLegalDocumentSnapshot, resolveStoreLegalDocument } from "@/lib/legal/store-documents";

describe("store legal document resolution", () => {
  const store = { name: "Sunset Mercantile", slug: "sunset-mercantile" };
  const settings = { support_email: "support@sunsetmercantile.com" };

  test("resolves admin-managed base content with store variables and addenda", () => {
    const document = resolveStoreLegalDocument("privacy", store, settings, {
      baseDocumentTitle: "Privacy Policy",
      baseBodyMarkdown: "# Privacy Policy\n\n{storeName} contact: {privacyContactEmail}.",
      baseVersionLabel: "v2.1",
      variables_json: {
        privacyContactEmail: "privacy@sunsetmercantile.com"
      },
      addendum_markdown: "## Store-specific privacy disclosures\n\nNo SMS marketing is enabled."
    });

    expect(document.title).toBe("Privacy Policy");
    expect(document.bodyMarkdown).toContain("Sunset Mercantile contact: privacy@sunsetmercantile.com.");
    expect(document.bodyMarkdown).toContain("No SMS marketing is enabled.");
    expect(document.baseVersionLabel).toBe("v2.1");
    expect(document.publishedVersion).toBeNull();
  });

  test("can resolve the published storefront snapshot separately from the editable draft", () => {
    const published = getPublishedStoreLegalDocumentSnapshot({
      id: "privacy-1",
      store_id: "store-1",
      key: "privacy",
      variables_json: { privacyContactEmail: "draft@example.com" },
      addendum_markdown: "Draft only",
      published_title: "Published Privacy Policy",
      published_body_markdown: "Published body for Sunset Mercantile. Contact privacy@sunsetmercantile.com.",
      published_variables_json: { privacyContactEmail: "privacy@sunsetmercantile.com" },
      published_addendum_markdown: "## Published addendum\n\nCalifornia residents can email us directly.",
      published_base_document_version_id: "base-privacy-v2",
      published_base_version_label: "v2.0",
      published_version: 3,
      published_change_summary: "Clarified privacy contact details.",
      effective_at: "2026-03-12T15:00:00.000Z",
      published_at: "2026-03-12T14:00:00.000Z",
      published_by_user_id: "user-1",
      created_at: "2026-03-12T13:00:00.000Z",
      updated_at: "2026-03-12T13:30:00.000Z"
    });

    const document = resolveStoreLegalDocument("privacy", store, settings, {
      baseDocumentTitle: published?.published_title ?? "Privacy Policy",
      baseBodyMarkdown: published?.published_body_markdown ?? "",
      baseVersionLabel: published?.published_base_version_label ?? null,
      variables_json: published?.variables_json ?? {},
      addendum_markdown: published?.addendum_markdown ?? "",
      publishedVersion: published?.published_version ?? null,
      publishedAt: published?.published_at ?? null,
      effectiveAt: published?.effective_at ?? null,
      changeSummary: published?.published_change_summary ?? null
    });

    expect(document.title).toBe("Published Privacy Policy");
    expect(document.bodyMarkdown).toContain("Published body for Sunset Mercantile.");
    expect(document.bodyMarkdown).toContain("California residents can email us directly.");
    expect(document.baseVersionLabel).toBe("v2.0");
    expect(document.publishedVersion).toBe(3);
    expect(document.changeSummary).toBe("Clarified privacy contact details.");
  });
});
