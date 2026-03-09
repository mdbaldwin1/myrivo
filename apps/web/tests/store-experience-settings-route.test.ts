import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type SupabaseMock = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

let supabaseMock: SupabaseMock;
let ownedStoreBundleMock:
  | {
      store: {
        id: string;
        name: string;
        slug: string;
        status: "draft" | "pending_review" | "active" | "suspended";
        stripe_account_id: string | null;
      };
      branding: {
        logo_path: string | null;
        primary_color: string | null;
        accent_color: string | null;
        theme_json: Record<string, unknown>;
      } | null;
      settings: {
        fulfillment_message: string | null;
        checkout_enable_local_pickup: boolean;
        checkout_local_pickup_label: string | null;
        checkout_local_pickup_fee_cents: number;
        checkout_enable_flat_rate_shipping: boolean;
        checkout_flat_rate_shipping_label: string | null;
        checkout_flat_rate_shipping_fee_cents: number;
        checkout_allow_order_note: boolean;
        checkout_order_note_prompt: string | null;
      } | null;
    }
  | null;
let originGuardResponse: Response | null = null;
let storesUpdatePayload: Record<string, unknown> | null = null;
let settingsUpsertPayload: Record<string, unknown> | null = null;
let storesUpdateErrorMessage: string | null = null;
let brandingUpsertErrorMessage: string | null = null;
let settingsUpsertErrorMessage: string | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabaseMock)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: vi.fn(async () => ownedStoreBundleMock)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: vi.fn(() => originGuardResponse)
}));

vi.mock("@/lib/shipping/store-config", () => ({
  getStoreShippingConfig: vi.fn(async () => ({
    provider: "none",
    source: "store",
    apiKey: null,
    webhookSecret: null
  }))
}));

async function callGetHandler(): Promise<Response> {
  const route = await import("@/app/api/store-experience/settings/route");
  if (!route.GET) {
    throw new Error("GET handler is not defined");
  }
  const response = await route.GET();
  if (!response) {
    throw new Error("GET handler returned no response");
  }
  return response;
}

async function callPutHandler(request: NextRequest): Promise<Response> {
  const route = await import("@/app/api/store-experience/settings/route");
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
      if (table === "stores") {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            storesUpdatePayload = payload;
            return {
              eq: vi.fn(async () => ({
                error: storesUpdateErrorMessage ? { message: storesUpdateErrorMessage } : null
              }))
            };
          })
        };
      }

      if (table === "store_branding") {
        return {
          upsert: vi.fn(async () => ({
            error: brandingUpsertErrorMessage ? { message: brandingUpsertErrorMessage } : null
          }))
        };
      }

      if (table === "store_settings") {
        return {
          upsert: vi.fn((payload: Record<string, unknown>) => {
            settingsUpsertPayload = payload;
            return Promise.resolve({
              error: settingsUpsertErrorMessage ? { message: settingsUpsertErrorMessage } : null
            });
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  } as SupabaseMock;
}

beforeEach(() => {
  supabaseMock = buildSupabaseMock();
  ownedStoreBundleMock = {
    store: {
      id: "store-1",
      name: "Store",
      slug: "store",
      status: "draft",
      stripe_account_id: null
    },
    branding: {
      logo_path: null,
      primary_color: null,
      accent_color: null,
      theme_json: {}
    },
    settings: {
      fulfillment_message: null,
      checkout_enable_local_pickup: false,
      checkout_local_pickup_label: "Porch pickup",
      checkout_local_pickup_fee_cents: 0,
      checkout_enable_flat_rate_shipping: true,
      checkout_flat_rate_shipping_label: "Shipped (flat fee)",
      checkout_flat_rate_shipping_fee_cents: 0,
      checkout_allow_order_note: false,
      checkout_order_note_prompt: "Note"
    }
  };
  originGuardResponse = null;
  storesUpdatePayload = null;
  settingsUpsertPayload = null;
  storesUpdateErrorMessage = null;
  brandingUpsertErrorMessage = null;
  settingsUpsertErrorMessage = null;
});

describe("store experience settings route", () => {
  test("GET returns grouped settings payload", async () => {
    const response = await callGetHandler();
    const payload = (await response.json()) as { settings: { profile: { id: string } } };

    expect(response.status).toBe(200);
    expect(payload.settings.profile.id).toBe("store-1");
  });

  test("PUT validates and writes profile + checkout updates", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: { name: "New Name" },
        checkoutRules: { checkoutEnableLocalPickup: true, checkoutLocalPickupFeeCents: 250 }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { ok: boolean; updatedAreas: string[] };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.updatedAreas).toEqual(expect.arrayContaining(["profile", "checkoutRules"]));
    expect(storesUpdatePayload).toMatchObject({ name: "New Name" });
    expect(settingsUpsertPayload).toMatchObject({
      store_id: "store-1",
      checkout_enable_local_pickup: true,
      checkout_local_pickup_fee_cents: 250
    });
  });

  test("PUT rejects invalid payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: { name: "x" }
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

  test("PUT returns origin guard response when request is untrusted", async () => {
    originGuardResponse = new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });

    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: { name: "Blocked Name" }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://malicious.test",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(403);
    expect(storesUpdatePayload).toBeNull();
    expect(settingsUpsertPayload).toBeNull();
  });

  test("PUT returns 404 when owner has no store", async () => {
    ownedStoreBundleMock = null;

    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: { name: "No Store" }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    expect(response.status).toBe(404);
  });

  test("PUT returns 500 when stores update fails", async () => {
    storesUpdateErrorMessage = "stores update failed";

    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: { name: "Error Path", status: "active" }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("stores update failed");
  });

  test("PUT returns 500 when branding upsert fails", async () => {
    brandingUpsertErrorMessage = "branding upsert failed";

    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        branding: { primaryColor: "#112233" }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("branding upsert failed");
  });

  test("PUT returns 500 when settings upsert fails", async () => {
    settingsUpsertErrorMessage = "settings upsert failed";

    const request = new NextRequest("http://localhost:3000/api/store-experience/settings", {
      method: "PUT",
      body: JSON.stringify({
        checkoutRules: { checkoutEnableLocalPickup: true }
      }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000"
      }
    });

    const response = await callPutHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("settings upsert failed");
  });
});
