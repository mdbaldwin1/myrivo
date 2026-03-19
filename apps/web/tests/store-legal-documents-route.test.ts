import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const getStoreLegalDocumentsByStoreIdMock = vi.fn();
const getStoreLegalDocumentByStoreIdMock = vi.fn();
const getStoreLegalDocumentVersionsByStoreIdMock = vi.fn();
const getPublishedStoreBaseLegalDocumentsMock = vi.fn();

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
let insertPayload: Record<string, unknown> | null = null;
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
    getStoreLegalDocumentsByStoreId: (...args: unknown[]) => getStoreLegalDocumentsByStoreIdMock(...args),
    getStoreLegalDocumentByStoreId: (...args: unknown[]) => getStoreLegalDocumentByStoreIdMock(...args),
    getStoreLegalDocumentVersionsByStoreId: (...args: unknown[]) => getStoreLegalDocumentVersionsByStoreIdMock(...args),
    getPublishedStoreBaseLegalDocuments: (...args: unknown[]) => getPublishedStoreBaseLegalDocumentsMock(...args)
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

      if (table === "store_legal_document_versions") {
        return {
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            insertPayload = payload;
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
  const response = await route.GET(new NextRequest(url));
  if (!response) {
    throw new Error("GET handler returned no response");
  }
  return response;
}

async function callPut(body: Record<string, unknown>) {
  const route = await import("@/app/api/stores/legal-documents/route");
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
    variables_json: {},
    addendum_markdown: "",
    published_title: "Published document",
    published_body_markdown: "Published body",
    published_variables_json: {},
    published_addendum_markdown: "",
    published_base_version_label: "v1.0",
    published_version: 1,
    published_change_summary: null,
    effective_at: null,
    published_at: null,
    ...overrides
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMock = buildSupabaseMock();
  ownedStoreBundleMock = {
    store: { id: "store-1", slug: "apothecary", name: "At Home Apothecary" },
    settings: { support_email: "hello@example.com" }
  };
  requestedStoreSlug = null;
  upsertPayload = null;
  updatePayload = null;
  insertPayload = null;
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  getStoreLegalDocumentsByStoreIdMock.mockReset();
  getStoreLegalDocumentByStoreIdMock.mockReset();
  getStoreLegalDocumentVersionsByStoreIdMock.mockReset();
  getPublishedStoreBaseLegalDocumentsMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  getStoreLegalDocumentsByStoreIdMock.mockResolvedValue([
    {
      id: "privacy-1",
      store_id: "store-1",
      key: "privacy",
      variables_json: { privacyContactEmail: "privacy@example.com" },
      addendum_markdown: "## Privacy addendum",
      published_title: "Published Privacy Policy",
      published_body_markdown: "Published privacy body",
      published_variables_json: { privacyContactEmail: "privacy@example.com" },
      published_addendum_markdown: "## Published privacy addendum",
      published_base_document_version_id: "base-privacy-v1",
      published_base_version_label: "v1.0",
      published_version: 2,
      published_change_summary: "Clarified privacy contact language.",
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
      variables_json: { termsContactEmail: "support@example.com", governingLawRegion: "New York" },
      addendum_markdown: "",
      published_title: "Published Terms",
      published_body_markdown: "Published terms body",
      published_variables_json: { termsContactEmail: "support@example.com", governingLawRegion: "New York" },
      published_addendum_markdown: "",
      published_base_document_version_id: "base-terms-v1",
      published_base_version_label: "v1.0",
      published_version: 1,
      published_change_summary: null,
      effective_at: "2026-03-09T00:00:00.000Z",
      published_at: "2026-03-09T00:00:00.000Z",
      published_by_user_id: "user-1",
      updated_at: "2026-03-12T00:00:00.000Z",
      created_at: "2026-03-12T00:00:00.000Z"
    }
  ]);
  getStoreLegalDocumentByStoreIdMock.mockResolvedValue({
    id: "privacy-1",
    store_id: "store-1",
    key: "privacy",
    variables_json: { privacyContactEmail: "privacy@example.com" },
    addendum_markdown: "## Privacy addendum",
    published_title: "Published Privacy Policy",
    published_body_markdown: "Published privacy body",
    published_variables_json: { privacyContactEmail: "privacy@example.com" },
    published_addendum_markdown: "",
    published_base_document_version_id: "base-privacy-v1",
    published_base_version_label: "v1.0",
    published_version: 2,
    published_change_summary: "Clarified privacy contact language.",
    effective_at: "2026-03-10T00:00:00.000Z",
    published_at: "2026-03-10T00:00:00.000Z",
    published_by_user_id: "user-1",
    updated_at: "2026-03-12T00:00:00.000Z",
    created_at: "2026-03-12T00:00:00.000Z"
  });
  getStoreLegalDocumentVersionsByStoreIdMock.mockResolvedValue([
    {
      id: "version-1",
      store_legal_document_id: "privacy-1",
      store_id: "store-1",
      key: "privacy",
      version_number: 2,
      title: "Published Privacy Policy",
      body_markdown: "Published privacy body",
      variables_json: { privacyContactEmail: "privacy@example.com" },
      addendum_markdown: "## Published privacy addendum",
      base_document_version_id: "base-privacy-v1",
      base_version_label: "v1.0",
      change_summary: "Clarified privacy contact language.",
      effective_at: "2026-03-10T00:00:00.000Z",
      published_at: "2026-03-10T00:00:00.000Z",
      published_by_user_id: "user-1",
      created_at: "2026-03-10T00:00:00.000Z"
    }
  ]);
  getPublishedStoreBaseLegalDocumentsMock.mockResolvedValue({
    privacy: {
      id: "base-privacy-v2",
      key: "privacy",
      title: "Storefront Privacy Policy Base",
      versionLabel: "v2.0",
      bodyMarkdown: "# Privacy Policy\n\nContact {privacyContactEmail}.",
      publishedAt: "2026-03-12T00:00:00.000Z",
      effectiveAt: "2026-03-12T00:00:00.000Z"
    },
    terms: {
      id: "base-terms-v2",
      key: "terms",
      title: "Storefront Terms Base",
      versionLabel: "v2.0",
      bodyMarkdown: "# Terms\n\nQuestions: {termsContactEmail}.",
      publishedAt: "2026-03-12T00:00:00.000Z",
      effectiveAt: "2026-03-12T00:00:00.000Z"
    }
  });
});

describe("store legal documents route", () => {
  test("GET returns base template metadata and store-specific fields", async () => {
    const response = await callGet();
    const payload = (await response.json()) as {
      documents: {
        privacy: { addendum_markdown: string; variables_json: Record<string, string>; published_base_version_label: string | null };
      };
      baseTemplates: {
        privacy: { versionLabel: string; title: string } | null;
      };
      store: { name: string; supportEmail: string | null };
    };

    expect(response.status).toBe(200);
    expect(requestedStoreSlug).toBe("apothecary");
    expect(payload.store.name).toBe("At Home Apothecary");
    expect(payload.documents.privacy.addendum_markdown).toBe("## Privacy addendum");
    expect(payload.documents.privacy.variables_json).toEqual({ privacyContactEmail: "privacy@example.com" });
    expect(payload.documents.privacy.published_base_version_label).toBe("v1.0");
    expect(payload.baseTemplates.privacy?.versionLabel).toBe("v2.0");
    expect(payload.baseTemplates.privacy?.title).toBe("Storefront Privacy Policy Base");
  });

  test("PUT upserts variables and addenda only and logs an audit event", async () => {
    const response = await callPut({
      privacy: buildEditorEntry({
        variables_json: { privacyContactEmail: "rights@example.com" },
        addendum_markdown: "## Store privacy addendum"
      }),
      terms: buildEditorEntry({
        variables_json: { termsContactEmail: "help@example.com", governingLawRegion: "New York" },
        addendum_markdown: "## Store terms addendum"
      })
    });

    expect(response.status).toBe(200);
    expect(upsertPayload).toEqual([
      expect.objectContaining({
        store_id: "store-1",
        key: "privacy",
        variables_json: { privacyContactEmail: "rights@example.com" },
        addendum_markdown: "## Store privacy addendum"
      }),
      expect.objectContaining({
        store_id: "store-1",
        key: "terms",
        variables_json: { termsContactEmail: "help@example.com", governingLawRegion: "New York" },
        addendum_markdown: "## Store terms addendum"
      })
    ]);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });

  test("PATCH publishes a composed store legal snapshot using the latest base template", async () => {
    const response = await callPatch({
      key: "privacy",
      changeSummary: "Clarified privacy rights contact details.",
      effectiveAt: "2026-03-15T16:30:00.000Z"
    });
    const payload = (await response.json()) as {
      documents: {
        privacy: { published_base_version_label: string | null; published_version: number };
      };
    };

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual(
      expect.objectContaining({
        published_title: "Privacy Policy",
        published_base_document_version_id: "base-privacy-v2",
        published_base_version_label: "v2.0",
        published_version: 3,
        published_change_summary: "Clarified privacy rights contact details.",
        effective_at: "2026-03-15T16:30:00.000Z",
        published_by_user_id: "user-1"
      })
    );
    expect(insertPayload).toEqual(
      expect.objectContaining({
        key: "privacy",
        version_number: 3,
        base_document_version_id: "base-privacy-v2",
        base_version_label: "v2.0"
      })
    );
    expect(payload.documents.privacy.published_base_version_label).toBe("v1.0");
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "publish",
        metadata: expect.objectContaining({
          key: "privacy",
          publishedVersion: 3,
          baseVersionLabel: "v2.0"
        })
      })
    );
  });

  test("PATCH rejects publishing when the base template is unavailable", async () => {
    getPublishedStoreBaseLegalDocumentsMock.mockResolvedValueOnce({ privacy: null, terms: null });

    const response = await callPatch({
      key: "privacy",
      changeSummary: "Clarified privacy rights contact details."
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("base template");
  });
});
