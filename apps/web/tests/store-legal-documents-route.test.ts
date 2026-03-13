import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const getStoreLegalDocumentsByStoreIdMock = vi.fn();

type SupabaseMock = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

let supabaseMock: SupabaseMock;
let ownedStoreBundleMock:
  | {
      store: { id: string; slug: string; name: string };
      settings: { support_email: string | null } | null;
    }
  | null;
let upsertPayload: Array<Record<string, unknown>> | null = null;
let updatePayload: Record<string, unknown> | null = null;
let privacyProfileUpsertPayload: Record<string, unknown> | null = null;
let requestedStoreSlug: string | null = null;

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabaseMock)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: vi.fn(async (_userId: string, storeSlug?: string | null) => {
    requestedStoreSlug = storeSlug ?? null;
    return ownedStoreBundleMock;
  })
}));

vi.mock("@/lib/legal/store-documents", async () => {
  const actual = await vi.importActual<typeof import("@/lib/legal/store-documents")>("@/lib/legal/store-documents");
  return {
    ...actual,
    getStoreLegalDocumentsByStoreId: (...args: unknown[]) => getStoreLegalDocumentsByStoreIdMock(...args)
  };
});

function buildSupabaseMock(): SupabaseMock {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } }))
    },
    from: vi.fn((table: string) => {
      if (table === "store_legal_documents") {
        return {
          upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
            upsertPayload = rows;
            return { error: null };
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload;
            const chain = {
              eq: vi.fn(() => chain)
            };
            return chain;
          })
        };
      }

      if (table === "store_privacy_profiles") {
        return {
          select: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              maybeSingle: vi.fn(async () => ({
                data: {
                  store_id: "store-1",
                  notice_at_collection_enabled: true,
                  checkout_notice_enabled: true,
                  newsletter_notice_enabled: true,
                  review_notice_enabled: true,
                  show_california_notice: true,
                  show_do_not_sell_link: false,
                  privacy_contact_email: "privacy@example.com",
                  privacy_rights_email: "rights@example.com",
                  privacy_contact_name: "Privacy team",
                  collection_notice_addendum_markdown: "",
                  california_notice_markdown: "California rights apply.",
                  do_not_sell_markdown: "",
                  request_page_intro_markdown: "",
                  created_at: "2026-03-12T00:00:00.000Z",
                  updated_at: "2026-03-12T00:00:00.000Z"
                },
                error: null
              }))
            };
            return chain;
          }),
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            privacyProfileUpsertPayload = payload;
            return { error: null };
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  };
}

async function callGet(url = "http://localhost:3000/api/stores/legal-documents?storeSlug=apothecary") {
  const route = await import("@/app/api/stores/legal-documents/route");
  if (!route.GET) {
    throw new Error("GET handler is not defined");
  }
  const response = await route.GET(new NextRequest(url));
  if (!response) {
    throw new Error("GET handler returned no response");
  }
  return response;
}

async function callPut(body: Record<string, unknown>) {
  const route = await import("@/app/api/stores/legal-documents/route");
  if (!route.PUT) {
    throw new Error("PUT handler is not defined");
  }
  const response = await route.PUT(
    new NextRequest("http://localhost:3000/api/stores/legal-documents?storeSlug=apothecary", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      },
      body: JSON.stringify(body)
    })
  );
  if (!response) {
    throw new Error("PUT handler returned no response");
  }
  return response;
}

async function callPatch(body: Record<string, unknown>) {
  const route = await import("@/app/api/stores/legal-documents/route");
  if (!route.PATCH) {
    throw new Error("PATCH handler is not defined");
  }
  const response = await route.PATCH(
    new NextRequest("http://localhost:3000/api/stores/legal-documents?storeSlug=apothecary", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      },
      body: JSON.stringify(body)
    })
  );
  if (!response) {
    throw new Error("PATCH handler returned no response");
  }
  return response;
}

function buildEditorEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    source_mode: "template",
    title_override: "Privacy Policy",
    body_markdown: "Legal body",
    variables_json: {},
    published_source_mode: "template",
    published_template_version: "v1",
    published_title: "Published Privacy Policy",
    published_body_markdown: "Published body",
    published_variables_json: {},
    published_version: 1,
    published_change_summary: null,
    effective_at: null,
    published_at: null,
    ...overrides
  };
}

beforeEach(() => {
  supabaseMock = buildSupabaseMock();
  ownedStoreBundleMock = {
    store: { id: "store-1", slug: "apothecary", name: "At Home Apothecary" },
    settings: { support_email: "hello@example.com" }
  };
  requestedStoreSlug = null;
  upsertPayload = null;
  updatePayload = null;
  privacyProfileUpsertPayload = null;
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  getStoreLegalDocumentsByStoreIdMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  getStoreLegalDocumentsByStoreIdMock.mockResolvedValue([
    {
      id: "privacy-1",
      store_id: "store-1",
      key: "privacy",
      source_mode: "template",
      template_version: "v1",
      title_override: "Privacy Policy",
      body_markdown: "Custom privacy body for {storeName}.",
      variables_json: { supportEmail: "hello@example.com", ignored: 123 },
      published_source_mode: "template",
      published_template_version: "v1",
      published_title: "Published Privacy Policy",
      published_body_markdown: "Published privacy body.",
      published_variables_json: { supportEmail: "hello@example.com" },
      published_version: 2,
      published_change_summary: "Clarified data usage language.",
      effective_at: "2026-03-10T00:00:00.000Z",
      published_at: "2026-03-10T00:00:00.000Z",
      published_by_user_id: "user-1",
      updated_at: "2026-03-12T00:00:00.000Z",
      created_at: "2026-03-12T00:00:00.000Z"
    },
    {
      id: "terms-1",
      store_id: "store-1",
      key: "terms",
      source_mode: "custom",
      template_version: "v1",
      title_override: "Store Terms",
      body_markdown: "Custom terms body.",
      variables_json: {},
      published_source_mode: "custom",
      published_template_version: "v1",
      published_title: "Published Store Terms",
      published_body_markdown: "Published terms body.",
      published_variables_json: {},
      published_version: 1,
      published_change_summary: null,
      effective_at: "2026-03-09T00:00:00.000Z",
      published_at: "2026-03-09T00:00:00.000Z",
      published_by_user_id: "user-1",
      updated_at: "2026-03-12T00:00:00.000Z",
      created_at: "2026-03-12T00:00:00.000Z"
    }
  ]);
});

describe("store legal documents route", () => {
  test("GET returns the legal document editor snapshot for the requested store", async () => {
    const response = await callGet();
    const payload = (await response.json()) as {
      documents: {
        privacyCompliance: { show_california_notice: boolean; privacy_rights_email: string };
        privacy: { body_markdown: string; variables_json: Record<string, string>; published_version: number; published_at: string | null };
        terms: { title_override: string; source_mode: string };
      };
      store: { name: string; supportEmail: string | null };
    };

    expect(response.status).toBe(200);
    expect(requestedStoreSlug).toBe("apothecary");
    expect(payload.store.name).toBe("At Home Apothecary");
    expect(payload.store.supportEmail).toBe("hello@example.com");
    expect(payload.documents.privacyCompliance).toMatchObject({
      show_california_notice: true,
      privacy_rights_email: "rights@example.com"
    });
    expect(payload.documents.privacy.body_markdown).toBe("Custom privacy body for {storeName}.");
    expect(payload.documents.privacy.variables_json).toEqual({ supportEmail: "hello@example.com" });
    expect(payload.documents.privacy.published_version).toBe(2);
    expect(payload.documents.privacy.published_at).toBe("2026-03-10T00:00:00.000Z");
    expect(payload.documents.terms).toMatchObject({
      title_override: "Store Terms",
      source_mode: "custom"
    });
  });

  test("PUT upserts both store legal documents and logs an audit event", async () => {
    const response = await callPut({
      privacyCompliance: {
        notice_at_collection_enabled: true,
        checkout_notice_enabled: true,
        newsletter_notice_enabled: true,
        review_notice_enabled: false,
        show_california_notice: true,
        show_do_not_sell_link: true,
        privacy_contact_email: "privacy@example.com",
        privacy_rights_email: "rights@example.com",
        privacy_contact_name: "Privacy team",
        collection_notice_addendum_markdown: "",
        california_notice_markdown: "California rights apply.",
        do_not_sell_markdown: "Opt out details.",
        request_page_intro_markdown: "Use this form for privacy requests."
      },
      privacy: buildEditorEntry({
        body_markdown: "Privacy body",
        variables_json: { supportEmail: "help@example.com" }
      }),
      terms: buildEditorEntry({
        source_mode: "custom",
        title_override: "Terms & Conditions",
        body_markdown: "Terms body"
      })
    });
    const payload = (await response.json()) as {
      documents: {
        privacy: { source_mode: string };
        terms: { source_mode: string };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.documents.privacy.source_mode).toBe("template");
    expect(payload.documents.terms.source_mode).toBe("custom");
    expect(upsertPayload).toEqual([
      expect.objectContaining({
        store_id: "store-1",
        key: "privacy",
        source_mode: "template",
        body_markdown: "Privacy body"
      }),
      expect.objectContaining({
        store_id: "store-1",
        key: "terms",
        source_mode: "custom",
        body_markdown: "Terms body"
      })
    ]);
    expect(privacyProfileUpsertPayload).toEqual(
      expect.objectContaining({
        store_id: "store-1",
        show_california_notice: true,
        show_do_not_sell_link: true,
        review_notice_enabled: false
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });

  test("GET returns 401 when no user is authenticated", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await callGet();

    expect(response.status).toBe(401);
  });

  test("PUT returns 404 when the user cannot access the store", async () => {
    ownedStoreBundleMock = null;

    const response = await callPut({
      privacyCompliance: {
        notice_at_collection_enabled: true,
        checkout_notice_enabled: true,
        newsletter_notice_enabled: true,
        review_notice_enabled: true,
        show_california_notice: false,
        show_do_not_sell_link: false,
        privacy_contact_email: "privacy@example.com",
        privacy_rights_email: "privacy@example.com",
        privacy_contact_name: "Privacy team",
        collection_notice_addendum_markdown: "",
        california_notice_markdown: "",
        do_not_sell_markdown: "",
        request_page_intro_markdown: ""
      },
      privacy: buildEditorEntry({ body_markdown: "Privacy body" }),
      terms: buildEditorEntry({
        title_override: "Terms & Conditions",
        body_markdown: "Terms body"
      })
    });

    expect(response.status).toBe(404);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  test("PATCH publishes the saved draft for a single document and logs audit metadata", async () => {
    const response = await callPatch({
      key: "privacy",
      changeSummary: "Clarified privacy support contact details.",
      effectiveAt: "2026-03-15T16:30:00.000Z"
    });
    const payload = (await response.json()) as {
      documents: {
        privacy: { published_version: number };
      };
    };

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual(
      expect.objectContaining({
        published_source_mode: "template",
        published_title: "Privacy Policy",
        published_body_markdown: "Custom privacy body for {storeName}.",
        published_version: 3,
        published_change_summary: "Clarified privacy support contact details.",
        effective_at: "2026-03-15T16:30:00.000Z",
        published_by_user_id: "user-1"
      })
    );
    expect(payload.documents.privacy.published_version).toBe(2);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "publish",
        metadata: expect.objectContaining({
          key: "privacy",
          publishedVersion: 3
        })
      })
    );
  });

  test("PATCH rejects publishing when there are no unpublished changes", async () => {
    getStoreLegalDocumentsByStoreIdMock.mockResolvedValueOnce([
      {
        id: "privacy-1",
        store_id: "store-1",
        key: "privacy",
        source_mode: "template",
        template_version: "v1",
        title_override: "Privacy Policy",
        body_markdown: "Published privacy body.",
        variables_json: { supportEmail: "hello@example.com" },
        published_source_mode: "template",
        published_template_version: "v1",
        published_title: "Privacy Policy",
        published_body_markdown: "Published privacy body.",
        published_variables_json: { supportEmail: "hello@example.com" },
        published_version: 2,
        published_change_summary: "Clarified data usage language.",
        effective_at: "2026-03-10T00:00:00.000Z",
        published_at: "2026-03-10T00:00:00.000Z",
        published_by_user_id: "user-1",
        updated_at: "2026-03-12T00:00:00.000Z",
        created_at: "2026-03-12T00:00:00.000Z"
      }
    ]);

    const response = await callPatch({
      key: "privacy",
      changeSummary: "No actual change.",
      effectiveAt: null
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("meaningful draft change");
    expect(updatePayload).toBeNull();
  });
});
