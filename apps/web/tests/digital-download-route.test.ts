import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: (...args: unknown[]) =>
    createSupabaseAdminClientMock(...args),
}));

const ACCESS_ID = "90000000-0000-0000-0000-000000000001";
const ORDER_ID = "40000000-0000-0000-0000-000000000001";
const ENTITLEMENT_ID = "80000000-0000-0000-0000-000000000001";
const VERSION_ID = "70000000-0000-0000-0000-000000000001";
const GRANT_ID = "a0000000-0000-0000-0000-000000000001";
const PRIVATE_PATH = "store/product/asset/v1/customer-file.pdf";
const SIGNED_URL = "https://storage.example.test/signed/customer-file.pdf";

type FakeOptions = {
  signingError?: { message: string };
};

function buildHardenedSchemaAdmin(options: FakeOptions = {}) {
  const events: string[] = [];

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "digital_order_access_tokens") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: ACCESS_ID,
                  order_id: ORDER_ID,
                  expires_at: "2099-08-12T12:00:00.000Z",
                  revoked_at: null,
                },
              })),
            })),
          })),
        };
      }

      if (table === "digital_order_entitlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: ENTITLEMENT_ID },
                })),
              })),
            })),
          })),
        };
      }

      if (table === "digital_product_asset_versions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                events.push("lookup-version");
                return { data: { storage_path: PRIVATE_PATH }, error: null };
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn(async (functionName: string, args: Record<string, unknown>) => {
      if (functionName === "reserve_digital_download_grant") {
        events.push("reserve");
        expect(args).toMatchObject({
          p_entitlement_id: ENTITLEMENT_ID,
          p_access_token_id: ACCESS_ID,
        });
        expect(args.p_reservation_key).toEqual(expect.any(String));
        expect(args.p_client_fingerprint_hash).toMatch(/^[a-f0-9]{64}$/);
        return {
          data: [
            {
              grant_id: GRANT_ID,
              asset_version_id: VERSION_ID,
              customer_filename: "customer-file.pdf",
              grant_status: "reserved",
              reservation_expires_at: "2099-08-12T12:05:00.000Z",
            },
          ],
          error: null,
        };
      }

      if (functionName === "commit_digital_download_grant") {
        events.push("commit");
        expect(args).toMatchObject({ p_grant_id: GRANT_ID });
        expect(args.p_client_fingerprint_hash).toMatch(/^[a-f0-9]{64}$/);
        return { data: "issued", error: null };
      }

      if (functionName === "release_digital_download_grant") {
        events.push("release");
        expect(args).toMatchObject({
          p_grant_id: GRANT_ID,
          p_safe_error: "Storage signing failed",
        });
        expect(args.p_client_fingerprint_hash).toMatch(/^[a-f0-9]{64}$/);
        return { data: "released", error: null };
      }

      throw new Error(`Unexpected RPC ${functionName}`);
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => {
          events.push("sign");
          if (options.signingError) {
            return { data: null, error: options.signingError };
          }
          return { data: { signedUrl: SIGNED_URL }, error: null };
        }),
      })),
    },
  };

  return { admin, events };
}

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
});

describe("hardened digital download route", () => {
  test("reserves, signs server-side, commits, and redirects", async () => {
    const { admin, events } = buildHardenedSchemaAdmin();
    createSupabaseAdminClientMock.mockReturnValue(admin);
    const route = await import(
      "@/app/api/digital-downloads/[token]/[entitlementId]/route"
    );

    const response = await route.GET(
      new NextRequest(
        `http://localhost:3000/api/digital-downloads/access-token/${ENTITLEMENT_ID}`,
        { headers: { "user-agent": "Myrivo route regression test" } },
      ),
      {
        params: Promise.resolve({
          token: "access-token",
          entitlementId: ENTITLEMENT_ID,
        }),
      },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
    expect(events).toEqual(["reserve", "lookup-version", "sign", "commit"]);
  });

  test("releases the reservation when storage signing fails", async () => {
    const { admin, events } = buildHardenedSchemaAdmin({
      signingError: { message: "Provider unavailable" },
    });
    createSupabaseAdminClientMock.mockReturnValue(admin);
    const route = await import(
      "@/app/api/digital-downloads/[token]/[entitlementId]/route"
    );

    const response = await route.GET(
      new NextRequest(
        `http://localhost:3000/api/digital-downloads/access-token/${ENTITLEMENT_ID}`,
        { headers: { "user-agent": "Myrivo route regression test" } },
      ),
      {
        params: Promise.resolve({
          token: "access-token",
          entitlementId: ENTITLEMENT_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to prepare download.",
    });
    expect(events).toEqual(["reserve", "lookup-version", "sign", "release"]);
  });
});
