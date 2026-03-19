import { describe, expect, test } from "vitest";
import { getStorePrivacyCollectionNotice, resolveStorePrivacyProfile } from "@/lib/privacy/store-privacy";

describe("store privacy profile helpers", () => {
  test("resolveStorePrivacyProfile falls back to support email defaults", () => {
    const profile = resolveStorePrivacyProfile(
      null,
      {
        notice_at_collection_enabled: true,
        checkout_notice_enabled: true,
        newsletter_notice_enabled: true,
        review_notice_enabled: true,
        show_california_notice: false,
        show_do_not_sell_link: false,
        key: "default",
        created_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z"
      },
      { support_email: "hello@example.com" }
    );

    expect(profile.privacyContactEmail).toBe("hello@example.com");
    expect(profile.privacyRightsEmail).toBe("hello@example.com");
    expect(profile.noticeAtCollectionEnabled).toBe(true);
    expect(profile.showCaliforniaNotice).toBe(false);
  });

  test("getStorePrivacyCollectionNotice builds store-aware links", () => {
    const profile = resolveStorePrivacyProfile(
      {
        store_id: "store-1",
        privacy_contact_email: "privacy@example.com",
        privacy_rights_email: "rights@example.com",
        privacy_contact_name: "Privacy team",
        collection_notice_addendum_markdown: "Additional notice details.",
        california_notice_markdown: "",
        do_not_sell_markdown: "",
        request_page_intro_markdown: "",
        created_at: "2026-03-13T00:00:00.000Z",
        updated_at: "2026-03-13T00:00:00.000Z"
      },
      {
        notice_at_collection_enabled: true,
        checkout_notice_enabled: true,
        newsletter_notice_enabled: true,
        review_notice_enabled: true,
        show_california_notice: true,
        show_do_not_sell_link: true,
        key: "default",
        created_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z"
      },
      null
    );

    const notice = getStorePrivacyCollectionNotice("newsletter", { name: "At Home Apothecary", slug: "at-home-apothecary" }, profile);

    expect(notice.policyHref).toBe("/privacy?store=at-home-apothecary");
    expect(notice.requestHref).toBe("/privacy/request?store=at-home-apothecary");
    expect(notice.doNotSellHref).toContain("opt_out_sale_share");
    expect(notice.addendumMarkdown).toBe("Additional notice details.");
  });
});
