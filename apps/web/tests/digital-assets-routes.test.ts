import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  AssetLifecycleError,
  completeAssetUpload,
  createAssetUploadIntent,
  removeAsset,
  reorderAssets,
  replaceAssetVersion,
} from "@/lib/digital-products/asset-service";
import {
  inspectStoredAssetStream,
  validateUploadDeclaration,
} from "@/lib/digital-products/asset-validation";

const STORE_ID = "10000000-0000-0000-0000-000000000001";
const PRODUCT_ID = "20000000-0000-0000-0000-000000000001";
const VARIANT_ID = "30000000-0000-0000-0000-000000000001";
const ASSET_ID = "60000000-0000-0000-0000-000000000001";
const VERSION_ID = "70000000-0000-0000-0000-000000000001";
const INTENT_ID = "a0000000-0000-4000-8000-000000000001";
const STORAGE_PATH = `${STORE_ID}/${PRODUCT_ID}/${ASSET_ID}/v1/artwork.pdf`;
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\nsmall fixture");

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

function buildAdmin(
  rpcImplementation: (name: string, args: Record<string, unknown>) => Promise<RpcResult>,
  storageOverrides: {
    uploadError?: { message: string };
    signedDownloadUrl?: string;
    removeError?: { message: string };
  } = {},
) {
  const storageEvents: string[] = [];
  const storage = {
    createSignedUploadUrl: vi.fn(async (path: string) => {
      storageEvents.push(`sign-upload:${path}`);
      return storageOverrides.uploadError
        ? { data: null, error: storageOverrides.uploadError }
        : {
            data: { signedUrl: "https://storage.test/upload", token: "upload-token" },
            error: null,
          };
    }),
    createSignedUrl: vi.fn(async (path: string, ttl: number) => {
      storageEvents.push(`sign-download:${path}:${ttl}`);
      return {
        data: {
          signedUrl:
            storageOverrides.signedDownloadUrl ??
            "https://storage.test/download",
        },
        error: null,
      };
    }),
    remove: vi.fn(async (paths: string[]) => {
      storageEvents.push(`remove:${paths.join(",")}`);
      return { data: null, error: storageOverrides.removeError ?? null };
    }),
  };
  return {
    admin: {
      rpc: vi.fn(rpcImplementation),
      storage: { from: vi.fn(() => storage) },
    },
    storage,
    storageEvents,
  };
}

function intentRow(overrides: Record<string, unknown> = {}) {
  return {
    intent_id: INTENT_ID,
    asset_id: ASSET_ID,
    asset_version_id: VERSION_ID,
    product_id: PRODUCT_ID,
    product_variant_id: VARIANT_ID,
    storage_path: STORAGE_PATH,
    expected_filename: "artwork.pdf",
    expected_mime_type: "application/pdf",
    expected_byte_size: PDF_BYTES.byteLength,
    version_number: 1,
    operation: "create",
    intent_status: "pending",
    expires_at: "2099-08-12T12:30:00.000Z",
    completed_version_id: null,
    ...overrides,
  };
}

describe("digital asset declaration and stored-byte verification", () => {
  it("rejects a MIME/extension pair that could otherwise spoof a supported type", () => {
    expect(
      validateUploadDeclaration({
        fileName: "artwork.png",
        mimeType: "application/pdf",
        sizeBytes: 100,
      }),
    ).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("detects the content signature and hashes a streamed object", async () => {
    const result = await inspectStoredAssetStream(
      new Response(PDF_BYTES, {
        headers: { "content-type": "application/pdf" },
      }),
      {
        expectedMimeType: "application/pdf",
        expectedSizeBytes: PDF_BYTES.byteLength,
        maxBytes: 1024,
      },
    );

    expect(result).toEqual({
      byteSize: PDF_BYTES.byteLength,
      checksumSha256: createHash("sha256").update(PDF_BYTES).digest("hex"),
      detectedMimeType: "application/pdf",
    });
  });

  it("rejects spoofed bytes even when storage repeats the declared MIME", async () => {
    const bytes = new TextEncoder().encode("not a pdf");
    await expect(
      inspectStoredAssetStream(
        new Response(bytes, {
          headers: { "content-type": "application/pdf" },
        }),
        {
          expectedMimeType: "application/pdf",
          expectedSizeBytes: bytes.byteLength,
          maxBytes: 1024,
        },
      ),
    ).rejects.toMatchObject({ code: "content_signature_mismatch" });
  });

  it("stops and rejects an object larger than the bounded stream limit", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        cancelled = true;
      },
    });

    await expect(
      inspectStoredAssetStream(
        new Response(body, { headers: { "content-type": "image/png" } }),
        {
          expectedMimeType: "image/png",
          expectedSizeBytes: 40,
          maxBytes: 16,
        },
      ),
    ).rejects.toMatchObject({ code: "stored_object_too_large" });
    expect(cancelled).toBe(true);
  });
});

describe("transactional digital asset service", () => {
  it("persists an upload intent before signing and never returns its private path", async () => {
    const events: string[] = [];
    const { admin } = buildAdmin(async (name, args) => {
      events.push(name);
      expect(name).toBe("create_digital_asset_upload_intent");
      expect(args).toMatchObject({
        p_store_id: STORE_ID,
        p_product_id: PRODUCT_ID,
        p_product_variant_id: VARIANT_ID,
        p_expected_filename: "artwork.pdf",
        p_expected_mime_type: "application/pdf",
        p_expected_byte_size: PDF_BYTES.byteLength,
        p_operation: "create",
      });
      return { data: [intentRow()], error: null };
    });

    const result = await createAssetUploadIntent({
      admin,
      storeId: STORE_ID,
      productId: PRODUCT_ID,
      productVariantId: VARIANT_ID,
      label: "Printable artwork",
      fileName: "artwork.pdf",
      mimeType: "application/pdf",
      sizeBytes: PDF_BYTES.byteLength,
    });

    expect(events).toEqual(["create_digital_asset_upload_intent"]);
    expect(result).toEqual({
      intentId: INTENT_ID,
      assetId: ASSET_ID,
      uploadUrl: "https://storage.test/upload",
      uploadToken: "upload-token",
      expiresAt: "2099-08-12T12:30:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain(STORAGE_PATH);
  });

  it("marks the persisted intent for cleanup when upload signing fails", async () => {
    const calls: string[] = [];
    const { admin, storageEvents } = buildAdmin(
      async (name) => {
        calls.push(name);
        if (name === "create_digital_asset_upload_intent") {
          return { data: [intentRow()], error: null };
        }
        if (name === "fail_digital_asset_upload_intent") {
          return { data: true, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
      { uploadError: { message: "provider secret failure" } },
    );

    await expect(
      createAssetUploadIntent({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        productVariantId: null,
        label: "File",
        fileName: "artwork.pdf",
        mimeType: "application/pdf",
        sizeBytes: PDF_BYTES.byteLength,
      }),
    ).rejects.toMatchObject({ publicMessage: "Unable to prepare upload." });
    expect(calls).toEqual([
      "create_digital_asset_upload_intent",
      "fail_digital_asset_upload_intent",
    ]);
    expect(storageEvents).toEqual([`sign-upload:${STORAGE_PATH}`]);
  });

  it("completes using only the server-owned intent and verified stored bytes", async () => {
    const calls: string[] = [];
    const { admin } = buildAdmin(async (name, args) => {
      calls.push(name);
      if (name === "get_digital_asset_upload_intent") {
        expect(args).toEqual({ p_intent_id: INTENT_ID, p_store_id: STORE_ID });
        return { data: [intentRow()], error: null };
      }
      if (name === "finalize_digital_asset_upload_intent") {
        expect(args).toMatchObject({
          p_intent_id: INTENT_ID,
          p_store_id: STORE_ID,
          p_actual_byte_size: PDF_BYTES.byteLength,
          p_detected_mime_type: "application/pdf",
          p_checksum_sha256: createHash("sha256").update(PDF_BYTES).digest("hex"),
        });
        return {
          data: [
            {
              asset_id: ASSET_ID,
              asset_version_id: VERSION_ID,
              product_id: PRODUCT_ID,
              mime_type: "application/pdf",
              version_number: 1,
              was_already_completed: false,
            },
          ],
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });

    const result = await completeAssetUpload({
      admin,
      storeId: STORE_ID,
      intentId: INTENT_ID,
      fetcher: vi.fn(async () =>
        new Response(PDF_BYTES, {
          headers: { "content-type": "application/pdf" },
        }),
      ),
    });

    expect(result).toMatchObject({
      assetId: ASSET_ID,
      versionId: VERSION_ID,
      productId: PRODUCT_ID,
      mimeType: "application/pdf",
      versionNumber: 1,
      alreadyCompleted: false,
    });
    expect(calls).toEqual([
      "get_digital_asset_upload_intent",
      "finalize_digital_asset_upload_intent",
    ]);
  });

  it("returns the completed version idempotently without signing or downloading again", async () => {
    const { admin, storageEvents } = buildAdmin(async (name) => {
      expect(name).toBe("get_digital_asset_upload_intent");
      return {
        data: [
          intentRow({
            intent_status: "completed",
            completed_version_id: VERSION_ID,
          }),
        ],
        error: null,
      };
    });
    const fetcher = vi.fn();

    const result = await completeAssetUpload({
      admin,
      storeId: STORE_ID,
      intentId: INTENT_ID,
      fetcher,
    });

    expect(result.alreadyCompleted).toBe(true);
    expect(result.versionId).toBe(VERSION_ID);
    expect(storageEvents).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("marks and removes an invalid uploaded object without exposing its path", async () => {
    const calls: string[] = [];
    const { admin, storageEvents } = buildAdmin(async (name) => {
      calls.push(name);
      if (name === "get_digital_asset_upload_intent") {
        return { data: [intentRow()], error: null };
      }
      if (name === "fail_digital_asset_upload_intent") {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const spoofed = new TextEncoder().encode("not a pdf");

    await expect(
      completeAssetUpload({
        admin,
        storeId: STORE_ID,
        intentId: INTENT_ID,
        fetcher: vi.fn(async () =>
          new Response(spoofed, {
            headers: { "content-type": "application/pdf" },
          }),
        ),
      }),
    ).rejects.toMatchObject({
      publicMessage: "Uploaded file could not be verified. Upload it again.",
    });
    expect(calls).toEqual([
      "get_digital_asset_upload_intent",
      "fail_digital_asset_upload_intent",
    ]);
    expect(storageEvents).toContain(`remove:${STORAGE_PATH}`);
  });

  it("returns a neutral not-found error when an intent is not owned by the store", async () => {
    const { admin } = buildAdmin(async () => ({ data: [], error: null }));
    await expect(
      completeAssetUpload({
        admin,
        storeId: STORE_ID,
        intentId: INTENT_ID,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AssetLifecycleError>>({
        status: 404,
        publicMessage: "Asset unavailable.",
      }),
    );
  });

  it("normalizes the database's concurrent 21st-file rejection", async () => {
    const { admin } = buildAdmin(async () => ({
      data: null,
      error: { message: "Digital asset active file limit reached", code: "P0001" },
    }));

    await expect(
      createAssetUploadIntent({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        productVariantId: null,
        label: "File 21",
        fileName: "artwork.pdf",
        mimeType: "application/pdf",
        sizeBytes: PDF_BYTES.byteLength,
      }),
    ).rejects.toMatchObject({
      status: 409,
      publicMessage: "This product already has the maximum number of files.",
    });
  });

  it("creates replacement uploads through the same immutable intent boundary", async () => {
    const { admin } = buildAdmin(async (name, args) => {
      expect(name).toBe("create_digital_asset_upload_intent");
      expect(args).toMatchObject({
        p_store_id: STORE_ID,
        p_asset_id: ASSET_ID,
        p_operation: "replace",
      });
      return {
        data: [intentRow({ operation: "replace", version_number: 2 })],
        error: null,
      };
    });

    const replacement = await replaceAssetVersion({
      admin,
      storeId: STORE_ID,
      assetId: ASSET_ID,
      fileName: "artwork.pdf",
      mimeType: "application/pdf",
      sizeBytes: PDF_BYTES.byteLength,
    });
    expect(replacement).toMatchObject({ intentId: INTENT_ID, assetId: ASSET_ID });
    expect(replacement).not.toHaveProperty("storagePath");
  });

  it("reorders the complete product list atomically", async () => {
    const secondAsset = "60000000-0000-0000-0000-000000000002";
    const { admin } = buildAdmin(async (name, args) => {
      expect(name).toBe("reorder_digital_product_assets");
      expect(args).toEqual({
        p_store_id: STORE_ID,
        p_product_id: PRODUCT_ID,
        p_asset_ids: [secondAsset, ASSET_ID],
      });
      return { data: 2, error: null };
    });
    await expect(
      reorderAssets({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        assetIds: [secondAsset, ASSET_ID],
      }),
    ).resolves.toEqual({ updatedCount: 2 });
  });

  it("removes an asset from the catalog without deleting purchased versions", async () => {
    const { admin } = buildAdmin(async (name, args) => {
      expect(name).toBe("deactivate_digital_product_asset");
      expect(args).toEqual({ p_store_id: STORE_ID, p_asset_id: ASSET_ID });
      return {
        data: [
          {
            deactivated: true,
            preserved_version_count: 2,
            entitlement_count: 1,
          },
        ],
        error: null,
      };
    });
    await expect(
      removeAsset({ admin, storeId: STORE_ID, assetId: ASSET_ID }),
    ).resolves.toEqual({
      deactivated: true,
      preservedVersionCount: 2,
      entitlementCount: 1,
    });
  });
});

const createSupabaseServerClientMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const completeAssetUploadMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));
vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) =>
    getOwnedStoreBundleMock(...args),
}));
vi.mock("@/lib/digital-products/asset-route-service", () => ({
  completeOwnedAssetUpload: (...args: unknown[]) => completeAssetUploadMock(...args),
}));

describe("digital asset completion route boundary", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    getOwnedStoreBundleMock.mockReset();
    completeAssetUploadMock.mockReset();
  });

  it("rejects an unauthenticated completion request", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });
    const route = await import("@/app/api/products/digital-assets/complete/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/products/digital-assets/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost",
          origin: "http://localhost",
        },
        body: JSON.stringify({ intentId: INTENT_ID }),
      }),
    );
    expect(response.status).toBe(401);
    expect(completeAssetUploadMock).not.toHaveBeenCalled();
  });

  it("accepts only an intent id and rejects client-supplied storage ownership metadata", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
    });
    getOwnedStoreBundleMock.mockResolvedValue({ store: { id: STORE_ID } });
    const route = await import("@/app/api/products/digital-assets/complete/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/products/digital-assets/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost",
          origin: "http://localhost",
        },
        body: JSON.stringify({ intentId: INTENT_ID, storagePath: "other-store/private" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(completeAssetUploadMock).not.toHaveBeenCalled();
  });
});
