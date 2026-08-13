import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: (...args: unknown[]) =>
    createSupabaseAdminClientMock(...args),
}));

const ACCESS_TOKEN = "a".repeat(43);
const ACCESS_TOKEN_HASH =
  "66d34fba71f8f450f7e45598853e53bfc23bbd129027cbb131a2f4ffd7878cd0";
const ACCESS_ID = "90000000-0000-4000-8000-000000000001";
const ORDER_ID = "40000000-0000-4000-8000-000000000001";
const STORE_ID = "10000000-0000-4000-8000-000000000001";
const ENTITLEMENT_ID = "80000000-0000-4000-8000-000000000001";
const PRODUCT_ID = "20000000-0000-4000-8000-000000000001";
const ASSET_ID = "60000000-0000-4000-8000-000000000001";
const VERSION_ID = "70000000-0000-4000-8000-000000000001";
const GRANT_ID = "a0000000-0000-4000-8000-000000000001";
const SESSION_ID = "b0000000-0000-4000-8000-000000000001";
const PRIVATE_PATH = `${STORE_ID}/${PRODUCT_ID}/${ASSET_ID}/v1/customer-file.pdf`;
const SIGNED_URL = "https://storage.example.test/signed/customer-file.pdf";
const INTERNAL_ERROR =
  'duplicate key value violates unique constraint "digital_download_grants_reservation_key_key"';

type FakeOptions = {
  rateLimited?: boolean;
  rateLimitError?: { message: string };
  authorizeData?: Record<string, unknown> | null;
  authorizeError?: { message: string };
  listData?: Array<Record<string, unknown>>;
  listError?: { message: string };
  reserveError?: { message: string };
  assetLookupError?: { message: string };
  assetLookupRejection?: Error;
  signingError?: { message: string };
  signingRejection?: Error;
  commitError?: { message: string };
  commitRejection?: Error;
  releaseRejection?: Error;
};

function buildAdmin(options: FakeOptions = {}) {
  const events: string[] = [];
  const rpcArgs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const releaseReasons: string[] = [];
  const storageLookups: Array<Record<string, string>> = [];
  const signedTtls: number[] = [];

  const admin = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcArgs.push({ name, args });
      if (name === "check_api_rate_limit") {
        events.push("rate-limit");
        if (options.rateLimitError) {
          return { data: null, error: options.rateLimitError };
        }
        return {
          data: [{ allowed: !options.rateLimited, retry_after_seconds: 17 }],
          error: null,
        };
      }

      if (name === "authorize_digital_download_access") {
        events.push("authorize");
        expect(args).toEqual({ p_token_hash: ACCESS_TOKEN_HASH });
        if (options.authorizeError) {
          return { data: null, error: options.authorizeError };
        }
        return {
          data:
            options.authorizeData === undefined
              ? [
                  {
                    access_token_id: ACCESS_ID,
                    order_id: ORDER_ID,
                    store_id: STORE_ID,
                    expires_at: "2099-08-12T12:00:00.000Z",
                  },
                ]
              : options.authorizeData
                ? [options.authorizeData]
                : [],
          error: null,
        };
      }

      if (name === "list_authorized_digital_downloads") {
        events.push("list");
        if (options.listError) {
          return { data: null, error: options.listError };
        }
        return {
          data:
            options.listData ??
            [
              {
                entitlement_id: ENTITLEMENT_ID,
                customer_filename: "customer-file.pdf",
                mime_type: "application/pdf",
                byte_size: 1024,
                status: "active",
                grants_remaining: 4,
              },
            ],
          error: null,
        };
      }

      if (name === "reserve_digital_download_grant") {
        events.push("reserve");
        if (options.reserveError) {
          return { data: null, error: options.reserveError };
        }
        return {
          data: [
            {
              grant_id: GRANT_ID,
              store_id: STORE_ID,
              product_id: PRODUCT_ID,
              asset_id: ASSET_ID,
              asset_version_id: VERSION_ID,
              customer_filename: "customer-file.pdf",
              grant_status: "reserved",
              reservation_expires_at: "2099-08-12T12:05:00.000Z",
            },
          ],
          error: null,
        };
      }

      if (name === "commit_digital_download_grant") {
        events.push("commit");
        if (options.commitRejection) throw options.commitRejection;
        if (options.commitError) return { data: null, error: options.commitError };
        return { data: "issued", error: null };
      }

      if (name === "release_digital_download_grant") {
        events.push("release");
        releaseReasons.push(String(args.p_safe_error));
        if (options.releaseRejection) throw options.releaseRejection;
        return { data: "released", error: null };
      }

      throw new Error(`Unexpected RPC ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table !== "digital_product_asset_versions") {
        throw new Error(`Unexpected table ${table}`);
      }
      const filters: Record<string, string> = {};
      const query = {
        eq: vi.fn((column: string, value: string) => {
          filters[column] = value;
          return query;
        }),
        maybeSingle: vi.fn(async () => {
          events.push("lookup-version");
          storageLookups.push({ ...filters });
          if (options.assetLookupRejection) throw options.assetLookupRejection;
          if (options.assetLookupError) {
            return { data: null, error: options.assetLookupError };
          }
          return { data: { storage_path: PRIVATE_PATH }, error: null };
        }),
      };
      return { select: vi.fn(() => query) };
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (_path: string, ttl: number) => {
          events.push("sign");
          signedTtls.push(ttl);
          if (options.signingRejection) throw options.signingRejection;
          if (options.signingError) {
            return { data: null, error: options.signingError };
          }
          return { data: { signedUrl: SIGNED_URL }, error: null };
        }),
      })),
    },
  };

  return {
    admin,
    events,
    rpcArgs,
    releaseReasons,
    storageLookups,
    signedTtls,
  };
}

function downloadRequest(options: {
  token?: string;
  entitlementId?: string;
  sessionId?: string | null;
  forwardedFor?: string;
  userAgent?: string;
} = {}) {
  const token = options.token ?? ACCESS_TOKEN;
  const entitlementId = options.entitlementId ?? ENTITLEMENT_ID;
  const headers = new Headers({
    "user-agent": options.userAgent ?? "Myrivo route regression test",
    "x-forwarded-for": options.forwardedFor ?? "198.51.100.8",
  });
  if (options.sessionId !== null) {
    headers.set(
      "cookie",
      `myrivo_download_session=${options.sessionId ?? SESSION_ID}`,
    );
  }
  return new NextRequest(
    `https://app.myrivo.test/api/digital-downloads/${token}/${entitlementId}`,
    { headers },
  );
}

async function invokeDownload(
  request = downloadRequest(),
  params: { token?: string; entitlementId?: string } = {},
) {
  const { GET } = await import(
    "@/app/api/digital-downloads/[token]/[entitlementId]/route"
  );
  return GET(request, {
    params: Promise.resolve({
      token: params.token ?? ACCESS_TOKEN,
      entitlementId: params.entitlementId ?? ENTITLEMENT_ID,
    }),
  });
}

async function invokeList(token = ACCESS_TOKEN) {
  const { GET } = await import("@/app/api/digital-downloads/[token]/route");
  return GET(
    new NextRequest(
      `https://app.myrivo.test/api/digital-downloads/${token}`,
      {
        headers: {
          "x-forwarded-for": "198.51.100.8",
          cookie: `myrivo_download_session=${SESSION_ID}`,
        },
      },
    ),
    { params: Promise.resolve({ token }) },
  );
}

function expectHardenedHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("content-security-policy")).toContain(
    "default-src 'none'",
  );
}

beforeEach(async () => {
  createSupabaseAdminClientMock.mockReset();
  const { hashDigitalAccessToken } = await import(
    "@/lib/digital-products/entitlements"
  );
  expect(hashDigitalAccessToken(ACCESS_TOKEN)).toBe(ACCESS_TOKEN_HASH);
});

describe("digital download grant route", () => {
  test("authorizes, reserves, looks up the bound version, signs for 300 seconds, commits, and redirects", async () => {
    const state = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
    expectHardenedHeaders(response);
    expect(state.events).toEqual([
      "rate-limit",
      "authorize",
      "reserve",
      "lookup-version",
      "sign",
      "commit",
    ]);
    expect(state.signedTtls).toEqual([300]);
    expect(state.storageLookups).toEqual([
      {
        id: VERSION_ID,
        asset_id: ASSET_ID,
        product_id: PRODUCT_ID,
        store_id: STORE_ID,
      },
    ]);
    const reserve = state.rpcArgs.find(
      (entry) => entry.name === "reserve_digital_download_grant",
    );
    expect(reserve?.args).toMatchObject({
      p_entitlement_id: ENTITLEMENT_ID,
      p_access_token_id: ACCESS_ID,
    });
    expect(reserve?.args.p_reservation_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    expect(reserve?.args.p_client_fingerprint_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("derives a stable privacy-safe fingerprint from the session cookie, not token, IP, or user agent", async () => {
    const first = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValueOnce(first.admin);
    await invokeDownload(
      downloadRequest({ forwardedFor: "198.51.100.8", userAgent: "Browser A" }),
    );

    const second = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValueOnce(second.admin);
    await invokeDownload(
      downloadRequest({ forwardedFor: "203.0.113.9", userAgent: "Browser B" }),
    );

    const firstFingerprint = first.rpcArgs.find(
      (entry) => entry.name === "reserve_digital_download_grant",
    )?.args.p_client_fingerprint_hash;
    const secondFingerprint = second.rpcArgs.find(
      (entry) => entry.name === "reserve_digital_download_grant",
    )?.args.p_client_fingerprint_hash;
    expect(firstFingerprint).toBe(secondFingerprint);
    expect(firstFingerprint).not.toBe(ACCESS_TOKEN);
    expect(firstFingerprint).not.toBe("198.51.100.8");
    expect(JSON.stringify(first.rpcArgs)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(first.rpcArgs)).not.toContain("198.51.100.8");
    expect(JSON.stringify(first.rpcArgs)).not.toContain("Browser A");
  });

  test("uses a different fingerprint for another access session", async () => {
    const first = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValueOnce(first.admin);
    await invokeDownload();
    const second = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValueOnce(second.admin);
    await invokeDownload(
      downloadRequest({
        sessionId: "b0000000-0000-4000-8000-000000000002",
      }),
    );

    const fingerprints = [first, second].map(
      (state) =>
        state.rpcArgs.find(
          (entry) => entry.name === "reserve_digital_download_grant",
        )?.args.p_client_fingerprint_hash,
    );
    expect(fingerprints[0]).not.toBe(fingerprints[1]);
  });

  test("creates an opaque HttpOnly session cookie when the browser has none", async () => {
    const state = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload(downloadRequest({ sessionId: null }));

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toMatch(
      /myrivo_download_session=[0-9a-f-]{36}.*HttpOnly.*SameSite=Lax/i,
    );
    expect(response.headers.get("set-cookie")).not.toContain(ACCESS_TOKEN);
  });

  test.each([
    { token: "short", entitlementId: ENTITLEMENT_ID },
    { token: `${"a".repeat(42)}!`, entitlementId: ENTITLEMENT_ID },
    { token: ACCESS_TOKEN, entitlementId: "not-a-uuid" },
  ])("rejects malformed path identifiers before database access", async (params) => {
    const state = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload(
      downloadRequest(params),
      params,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Download unavailable.",
    });
    expect(state.events).toEqual([]);
    expectHardenedHeaders(response);
  });

  test("uses the shared database throttle and stores only a hashed request identifier", async () => {
    const state = buildAdmin({ rateLimited: true });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(state.events).toEqual(["rate-limit"]);
    const rateLimit = state.rpcArgs[0];
    expect(rateLimit?.args.p_bucket_key).toMatch(
      /^digital-download-grant:[a-f0-9]{64}$/,
    );
    expect(rateLimit?.args.p_bucket_key).not.toContain("198.51.100.8");
    expect(rateLimit?.args.p_bucket_key).not.toContain(ACCESS_TOKEN);
    expectHardenedHeaders(response);
  });

  test("fails closed without exposing the shared throttle error", async () => {
    const state = buildAdmin({
      rateLimitError: { message: "relation api_rate_limits unavailable" },
    });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Download service is temporarily unavailable.",
    });
    expect(JSON.stringify(body)).not.toContain("api_rate_limits");
    expect(state.events).toEqual(["rate-limit"]);
  });

  test("uses one neutral response for absent, expired, revoked, refunded, or disputed access", async () => {
    const state = buildAdmin({ authorizeData: null });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "This access link is unavailable.",
    });
    expect(state.events).toEqual(["rate-limit", "authorize"]);
  });

  test("does not expose an internal reserve error", async () => {
    const state = buildAdmin({ reserveError: { message: INTERNAL_ERROR } });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Download unavailable." });
    expect(JSON.stringify(body)).not.toContain(INTERNAL_ERROR);
    expect(state.events).toEqual(["rate-limit", "authorize", "reserve"]);
  });

  test.each([
    {
      name: "returns an error",
      options: { assetLookupError: { message: "Database unavailable" } },
      events: ["lookup-version"],
      reason: "Asset lookup failed",
    },
    {
      name: "rejects",
      options: { assetLookupRejection: new Error("Database unavailable") },
      events: ["lookup-version"],
      reason: "Asset lookup failed",
    },
    {
      name: "signing returns an error",
      options: { signingError: { message: "Provider unavailable" } },
      events: ["lookup-version", "sign"],
      reason: "Storage signing failed",
    },
    {
      name: "signing rejects",
      options: { signingRejection: new Error("Provider unavailable") },
      events: ["lookup-version", "sign"],
      reason: "Storage signing failed",
    },
  ])("releases the reservation when post-reserve $name", async ({ options, events, reason }) => {
    const state = buildAdmin(options);
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to prepare download.",
    });
    expect(state.events).toEqual([
      "rate-limit",
      "authorize",
      "reserve",
      ...events,
      "release",
    ]);
    expect(state.releaseReasons).toEqual([reason]);
  });

  test.each([
    { name: "returns an error", options: { commitError: { message: "Database unavailable" } } },
    { name: "rejects", options: { commitRejection: new Error("Database unavailable") } },
  ])("releases exactly once when grant commit $name", async ({ options }) => {
    const state = buildAdmin(options);
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to finalize download.",
    });
    expect(state.events).toEqual([
      "rate-limit",
      "authorize",
      "reserve",
      "lookup-version",
      "sign",
      "commit",
      "release",
    ]);
    expect(state.releaseReasons).toEqual(["Grant commit failed"]);
  });

  test("does not let cleanup rejection mask a generic signing failure", async () => {
    const state = buildAdmin({
      signingRejection: new Error("Provider unavailable"),
      releaseRejection: new Error("Release unavailable"),
    });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeDownload();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to prepare download.",
    });
    expect(state.releaseReasons).toEqual(["Storage signing failed"]);
  });
});

describe("digital download list route", () => {
  test("returns only safe customer metadata without order, token, grant, or storage internals", async () => {
    const state = buildAdmin();
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeList();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      expiresAt: "2099-08-12T12:00:00.000Z",
      files: [
        {
          id: ENTITLEMENT_ID,
          customerFilename: "customer-file.pdf",
          mimeType: "application/pdf",
          byteSize: 1024,
          status: "active",
          grantsRemaining: 4,
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(
      /orderId|accessTokenId|storage|path|grant_id|token_hash/i,
    );
    expect(state.events).toEqual(["rate-limit", "authorize", "list"]);
    expectHardenedHeaders(response);
  });

  test("returns a generic server response instead of database details", async () => {
    const state = buildAdmin({
      listError: { message: "column private.storage_path does not exist" },
    });
    createSupabaseAdminClientMock.mockReturnValue(state.admin);

    const response = await invokeList();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Download service is temporarily unavailable.",
    });
    expect(JSON.stringify(body)).not.toContain("storage_path");
  });
});
