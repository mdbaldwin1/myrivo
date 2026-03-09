import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type SupabaseMock = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

let supabaseMock: SupabaseMock;
let ownedStoreBundleMock: { store: { id: string } } | null = { store: { id: "store-1" } };
let lastRequestedStoreSlug: string | null = null;
let originGuardResponse: Response | null = null;
let lastUpsertPayload: Record<string, unknown> | null = null;
let selectErrorMessage: string | null = null;
let upsertErrorMessage: string | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabaseMock)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: vi.fn(async (_userId: string, storeSlug?: string | null) => {
    lastRequestedStoreSlug = storeSlug ?? null;
    return ownedStoreBundleMock;
  })
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: vi.fn(() => originGuardResponse)
}));

async function callGetHandler(url = "http://localhost:3000/api/store-experience/content"): Promise<Response> {
  const route = await import("@/app/api/store-experience/content/route");
  if (!route.GET) {
    throw new Error("GET handler is not defined");
  }
  const response = await route.GET(new NextRequest(url));
  if (!response) {
    throw new Error("GET handler returned no response");
  }
  return response;
}

async function callPutHandler(request: NextRequest): Promise<Response> {
  const route = await import("@/app/api/store-experience/content/route");
  if (!route.PUT) {
    throw new Error("PUT handler is not defined");
  }
  const response = await route.PUT(request);
  if (!response) {
    throw new Error("PUT handler returned no response");
  }
  return response;
}

function buildSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } }))
    },
    from: vi.fn((table: string) => {
      if (table !== "store_experience_content") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: selectErrorMessage ? { message: selectErrorMessage } : null
            }))
          }))
        })),
        upsert: vi.fn((payload: Record<string, unknown>) => {
          lastUpsertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  store_id: "store-1",
                  home_json: payload.home_json ?? {},
                  products_page_json: payload.products_page_json ?? {},
                  about_page_json: payload.about_page_json ?? {},
                  policies_page_json: payload.policies_page_json ?? {},
                  cart_page_json: payload.cart_page_json ?? {},
                  order_summary_page_json: payload.order_summary_page_json ?? {},
                  emails_json: payload.emails_json ?? {}
                },
                error: upsertErrorMessage ? { message: upsertErrorMessage } : null
              }))
            }))
          };
        })
      };
    })
  } as SupabaseMock;
}

beforeEach(() => {
  supabaseMock = buildSupabaseMock();
  ownedStoreBundleMock = { store: { id: "store-1" } };
  originGuardResponse = null;
  lastUpsertPayload = null;
  selectErrorMessage = null;
  upsertErrorMessage = null;
  lastRequestedStoreSlug = null;
});

describe("store experience content route", () => {
  test("GET returns default content when row is missing", async () => {
    const response = await callGetHandler();
    const payload = (await response.json()) as { source: string; content: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(payload.source).toBe("default");
    expect(payload.content).toMatchObject({
      home: {},
      productsPage: {},
      aboutPage: {},
      policiesPage: {},
      cartPage: {},
      orderSummaryPage: {},
      emails: {}
    });
  });

  test("PUT validates payload and writes correct section column", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({
        section: "home",
        value: {
          announcement: "Hello"
        }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { updatedSection: string };

    expect(response.status).toBe(200);
    expect(payload.updatedSection).toBe("home");
    expect(lastUpsertPayload).toMatchObject({
      store_id: "store-1",
      home_json: { announcement: "Hello" }
    });
  });

  test("GET resolves the requested store slug when provided", async () => {
    const response = await callGetHandler("http://localhost:3000/api/store-experience/content?storeSlug=second-store");

    expect(response.status).toBe(200);
    expect(lastRequestedStoreSlug).toBe("second-store");
  });

  test("PUT returns 400 for invalid body", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({ section: "invalid" }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(400);
  });

  test("PUT returns 400 for invalid home hero brandDisplay value", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({
        section: "home",
        value: {
          hero: {
            brandDisplay: "wordmark"
          }
        }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(400);
  });

  test("PUT returns 400 for invalid products image fit value", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({
        section: "productsPage",
        value: {
          productCards: {
            imageFit: "stretch"
          }
        }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(400);
  });

  test("PUT returns 400 for invalid emails reply-to address", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({
        section: "emails",
        value: {
          transactional: {
            replyToEmail: "not-an-email"
          }
        }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(400);
  });

  test("GET returns 401 when user is not authenticated", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await callGetHandler();
    expect(response.status).toBe(401);
  });

  test("GET returns 404 when owner has no store", async () => {
    ownedStoreBundleMock = null;

    const response = await callGetHandler();
    expect(response.status).toBe(404);
  });

  test("GET returns 500 when content read fails", async () => {
    selectErrorMessage = "select failed";

    const response = await callGetHandler();
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("select failed");
  });

  test("PUT returns origin guard response when request is untrusted", async () => {
    originGuardResponse = new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });

    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({ section: "home", value: { announcement: "Blocked" } }),
      headers: {
        "content-type": "application/json",
        origin: "http://malicious.test",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(403);
    expect(lastUpsertPayload).toBeNull();
  });

  test("PUT returns 404 when owner has no store", async () => {
    ownedStoreBundleMock = null;

    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({ section: "home", value: { announcement: "No Store" } }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(404);
  });

  test("PUT returns 500 when content upsert fails", async () => {
    upsertErrorMessage = "upsert failed";

    const request = new NextRequest("http://localhost:3000/api/store-experience/content", {
      method: "PUT",
      body: JSON.stringify({ section: "home", value: { announcement: "Fail" } }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("upsert failed");
  });
});
