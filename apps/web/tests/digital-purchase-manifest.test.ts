import { beforeEach, describe, expect, test, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: rpcMock })
}));

const manifestId = "b0000000-0000-4000-8000-000000000001";
const checkoutSessionId = "e0000000-0000-4000-8000-000000000001";
const storeId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const variantId = "30000000-0000-4000-8000-000000000001";
const assetId = "60000000-0000-4000-8000-000000000001";
const versionId = "70000000-0000-4000-8000-000000000002";

const snapshot = {
  manifestId,
  orderId: null,
  checkoutSessionId,
  storeId,
  consentVersion: "immediate-delivery-v1",
  licenseVersion: "personal-use-v1",
  createdAt: "2026-08-13T04:00:00.000Z",
  items: [
    {
      orderItemId: null,
      productId,
      productVariantId: variantId,
      assetId,
      assetVersionId: versionId,
      customerFilename: "gallery-print.zip",
      mimeType: "application/zip",
      byteSize: 2048,
      checksumSha256: "a".repeat(64),
      label: "Printable gallery set",
      sortOrder: 0
    }
  ]
};

describe("digital purchase manifests", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  test("creates the checkout snapshot through the atomic database boundary", async () => {
    rpcMock.mockResolvedValue({ data: snapshot, error: null });
    const { createOrReuseCheckoutManifest } = await import(
      "@/lib/digital-products/manifest-service"
    );

    const result = await createOrReuseCheckoutManifest({
      checkoutSessionId,
      storeId,
      items: [
        {
          productId,
          variantId,
          quantity: 1,
          productTitle: "Gallery set",
          unitPriceCents: 1800
        }
      ],
      consent: {
        version: "immediate-delivery-v1",
        acceptedAt: "2026-08-13T03:59:00.000Z"
      }
    });

    expect(result).toEqual(snapshot);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_or_reuse_digital_checkout_manifest",
      {
        p_checkout_session_id: checkoutSessionId,
        p_store_id: storeId,
        p_items: [
          {
            productId,
            variantId,
            quantity: 1,
            productTitle: "Gallery set",
            unitPriceCents: 1800
          }
        ],
        p_consent_version: "immediate-delivery-v1",
        p_consent_accepted_at: "2026-08-13T03:59:00.000Z",
        p_license_version: "personal-use-v1"
      }
    );
  });

  test("returns the exact immutable snapshot when the same checkout attempt is retried", async () => {
    rpcMock.mockResolvedValue({ data: snapshot, error: null });
    const { createOrReuseCheckoutManifest } = await import(
      "@/lib/digital-products/manifest-service"
    );
    const input = {
      checkoutSessionId,
      storeId,
      items: [{ productId, variantId, quantity: 1 }],
      consent: {
        version: "immediate-delivery-v1" as const,
        acceptedAt: "2026-08-13T03:59:00.000Z"
      }
    };

    const first = await createOrReuseCheckoutManifest(input);
    const retried = await createOrReuseCheckoutManifest(input);

    expect(retried).toEqual(first);
    expect(Object.isFrozen(retried)).toBe(true);
    expect(Object.isFrozen(retried.items)).toBe(true);
    expect(Object.isFrozen(retried.items[0])).toBe(true);
  });

  test("uses a neutral typed checkout error without exposing database details", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message:
          "Digital checkout bundle is not ready: private/store/product/file.pdf"
      }
    });
    const {
      createOrReuseCheckoutManifest,
      DigitalPurchaseManifestError
    } = await import("@/lib/digital-products/manifest-service");

    await expect(
      createOrReuseCheckoutManifest({
        checkoutSessionId,
        storeId,
        items: [{ productId, variantId, quantity: 1 }],
        consent: {
          version: "immediate-delivery-v1",
          acceptedAt: "2026-08-13T03:59:00.000Z"
        }
      })
    ).rejects.toEqual(
      expect.objectContaining({
        name: "DigitalPurchaseManifestError",
        code: "digital_bundle_not_ready",
        message: "Digital files are not ready for checkout."
      })
    );
    expect(DigitalPurchaseManifestError).toEqual(expect.any(Function));
  });

  test("locks the snapshot to the exact order and order item IDs", async () => {
    const locked = {
      ...snapshot,
      orderId: "40000000-0000-4000-8000-000000000001",
      items: [
        {
          ...snapshot.items[0],
          orderItemId: "50000000-0000-4000-8000-000000000001"
        }
      ]
    };
    rpcMock.mockResolvedValue({ data: locked, error: null });
    const { lockManifestToOrder } = await import(
      "@/lib/digital-products/manifest-service"
    );

    await expect(
      lockManifestToOrder(
        manifestId,
        "40000000-0000-4000-8000-000000000001"
      )
    ).resolves.toEqual(locked);
    expect(rpcMock).toHaveBeenCalledWith("lock_digital_checkout_manifest", {
      p_manifest_id: manifestId,
      p_order_id: "40000000-0000-4000-8000-000000000001"
    });
  });

  test("builds Stripe metadata containing only the opaque manifest identifier", async () => {
    const { buildDigitalManifestStripeMetadata } = await import(
      "@/lib/digital-products/manifest-service"
    );

    expect(buildDigitalManifestStripeMetadata(manifestId)).toEqual({
      digital_manifest_id: manifestId
    });
  });
});
