import { describe, expect, it } from "vitest";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import {
  isDigitalProductPublishable,
  resolveDigitalProductReadiness,
  resolveApplicableDigitalAssets,
  type DigitalAssetCandidate,
} from "@/lib/digital-products/domain";
import type {
  DigitalProductReadinessInput,
  DigitalPurchaseManifest,
} from "@/lib/digital-products/types";

const readyProductAsset: DigitalAssetCandidate = {
  id: "asset-product",
  productVariantId: null,
  status: "ready",
  active: true,
};

const readyVersion = {
  id: "version-ready",
  status: "ready" as const,
  retiredAt: null,
};

const preStripeManifest: DigitalPurchaseManifest = {
  manifestId: "manifest-1",
  orderId: null,
  checkoutSessionId: null,
  storeId: "store-1",
  consentVersion: "immediate-delivery-v1",
  licenseVersion: "personal-use-v1",
  createdAt: "2026-08-12T12:00:00.000Z",
  items: [],
};

function makeReadinessInput(
  overrides: Partial<DigitalProductReadinessInput> = {},
): DigitalProductReadinessInput {
  return {
    product: {
      product_type: "digital",
      digital_rights_affirmed_at: "2026-08-12T12:00:00.000Z",
    },
    previewStatus: "ready",
    variants: [],
    assets: [
      {
        id: "asset-product",
        productVariantId: null,
        active: true,
        versions: [readyVersion],
      },
    ],
    ...overrides,
  };
}

describe("digital product asset resolution", () => {
  it("includes product-wide assets and only assets for the purchased variant", () => {
    const assets: DigitalAssetCandidate[] = [
      readyProductAsset,
      {
        id: "asset-blue",
        productVariantId: "variant-blue",
        status: "ready",
        active: true,
      },
      {
        id: "asset-red",
        productVariantId: "variant-red",
        status: "ready",
        active: true,
      },
      {
        id: "asset-failed",
        productVariantId: null,
        status: "failed",
        active: true,
      },
      {
        id: "asset-retired",
        productVariantId: null,
        status: "ready",
        active: false,
      },
    ];

    expect(
      resolveApplicableDigitalAssets(assets, "variant-blue").map(
        (asset) => asset.id,
      ),
    ).toEqual(["asset-product", "asset-blue"]);
  });

  it("requires a ready preview and at least one applicable file for every active variant", () => {
    expect(
      isDigitalProductPublishable({
        productType: "digital",
        rightsAffirmed: true,
        previewStatus: "ready",
        activeVariantIds: ["variant-blue", "variant-red"],
        assets: [
          {
            id: "asset-blue",
            productVariantId: "variant-blue",
            status: "ready",
            active: true,
          },
          {
            id: "asset-red",
            productVariantId: "variant-red",
            status: "processing",
            active: true,
          },
        ],
      }),
    ).toEqual({
      publishable: false,
      reason: "Every active variant needs at least one ready customer file.",
    });

    expect(
      isDigitalProductPublishable({
        productType: "digital",
        rightsAffirmed: true,
        previewStatus: "ready",
        activeVariantIds: ["variant-blue", "variant-red"],
        assets: [readyProductAsset],
      }),
    ).toEqual({ publishable: true, reason: null });
  });

  it("leaves physical product publishing unchanged", () => {
    expect(
      isDigitalProductPublishable({
        productType: "physical",
        rightsAffirmed: false,
        previewStatus: "missing",
        activeVariantIds: [],
        assets: [],
      }),
    ).toEqual({ publishable: true, reason: null });
  });
});

describe("digital delivery configuration", () => {
  it("keeps retry, lease, and batch controls in validated configuration", () => {
    expect(DIGITAL_PRODUCT_CONFIG.deliveryLeaseSeconds).toBeGreaterThan(0);
    expect(DIGITAL_PRODUCT_CONFIG.deliveryMaxAttempts).toBeGreaterThan(1);
    expect(DIGITAL_PRODUCT_CONFIG.deliveryRetryBaseSeconds).toBeGreaterThan(0);
    expect(DIGITAL_PRODUCT_CONFIG.deliveryRetryMaxSeconds).toBeGreaterThanOrEqual(
      DIGITAL_PRODUCT_CONFIG.deliveryRetryBaseSeconds,
    );
    expect(DIGITAL_PRODUCT_CONFIG.deliveryProcessBatchSize).toBeGreaterThan(0);
  });
});

describe("digital product publishing readiness", () => {
  it("reports a missing rights affirmation", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          product: {
            product_type: "digital",
            digital_rights_affirmed_at: null,
          },
        }),
      ),
    ).toEqual({
      ready: false,
      reasons: ["rights_missing"],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it.each(["missing", "failed"] as const)(
    "reports a %s preview as not ready",
    (previewStatus) => {
      expect(
        resolveDigitalProductReadiness(makeReadinessInput({ previewStatus })),
      ).toEqual({
        ready: false,
        reasons: ["preview_not_ready"],
        applicableFileCount: 1,
        previewStatus,
      });
    },
  );

  it("does not count an active asset without a ready version", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          assets: [
            {
              id: "asset-processing",
              productVariantId: null,
              active: true,
              versions: [
                {
                  id: "version-processing",
                  status: "processing",
                  retiredAt: null,
                },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      ready: false,
      reasons: ["product_missing_file"],
      applicableFileCount: 0,
      previewStatus: "ready",
    });
  });

  it("uses one product-wide ready file to cover every active variant", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          variants: [
            { id: "variant-blue", status: "active" },
            { id: "variant-red", status: "active" },
          ],
        }),
      ),
    ).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("reports every active variant without an applicable ready file", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          variants: [
            { id: "variant-blue", status: "active" },
            { id: "variant-red", status: "active" },
          ],
          assets: [
            {
              id: "asset-blue",
              productVariantId: "variant-blue",
              active: true,
              versions: [readyVersion],
            },
          ],
        }),
      ),
    ).toEqual({
      ready: false,
      reasons: ["variant_missing_file:variant-red"],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("ignores archived variants and files assigned only to them", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          variants: [
            { id: "variant-blue", status: "active" },
            { id: "variant-archived", status: "archived" },
          ],
          assets: [
            {
              id: "asset-blue",
              productVariantId: "variant-blue",
              active: true,
              versions: [readyVersion],
            },
            {
              id: "asset-archived",
              productVariantId: "variant-archived",
              active: true,
              versions: [readyVersion],
            },
          ],
        }),
      ),
    ).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("reports a fully ready product with each active variant covered", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          variants: [
            { id: "variant-blue", status: "active" },
            { id: "variant-red", status: "active" },
          ],
          assets: [
            {
              id: "asset-blue",
              productVariantId: "variant-blue",
              active: true,
              versions: [readyVersion],
            },
            {
              id: "asset-red",
              productVariantId: "variant-red",
              active: true,
              versions: [
                { id: "version-failed", status: "failed", retiredAt: null },
                { id: "version-red-ready", status: "ready", retiredAt: null },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 2,
      previewStatus: "ready",
    });
  });

  it("returns all independent readiness failures together", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          product: {
            product_type: "digital",
            digital_rights_affirmed_at: null,
          },
          previewStatus: "processing",
          variants: [{ id: "variant-blue", status: "active" }],
          assets: [],
        }),
      ),
    ).toEqual({
      ready: false,
      reasons: [
        "rights_missing",
        "preview_not_ready",
        "variant_missing_file:variant-blue",
      ],
      applicableFileCount: 0,
      previewStatus: "processing",
    });
  });

  it("leaves physical products ready without digital requirements", () => {
    expect(
      resolveDigitalProductReadiness(
        makeReadinessInput({
          product: {
            product_type: "physical",
            digital_rights_affirmed_at: null,
          },
          previewStatus: "missing",
          variants: [{ id: "variant-blue", status: "active" }],
          assets: [],
        }),
      ),
    ).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 0,
      previewStatus: "missing",
    });
  });
});

describe("digital product production contract", () => {
  it("allows an immutable manifest snapshot before Stripe session association", () => {
    expect(preStripeManifest.checkoutSessionId).toBeNull();
  });

  it("freezes the nested supported MIME-extension mapping", () => {
    expect(Object.isFrozen(DIGITAL_PRODUCT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DIGITAL_PRODUCT_CONFIG.acceptedFiles)).toBe(true);
  });

  it("keeps the upload intent lifetime within the validated server ceiling", () => {
    expect(DIGITAL_PRODUCT_CONFIG.uploadIntentTtlSeconds).toBeLessThanOrEqual(
      DIGITAL_PRODUCT_CONFIG.maxUploadIntentTtlSeconds,
    );
  });
});

describe("readiness for a product sold more than one way", () => {
  const rights = "2026-08-12T12:00:00.000Z";

  it("asks only the download variant for a file", () => {
    // A painting: one variant is the download, the other two are posted.
    const readiness = resolveDigitalProductReadiness({
      product: { product_type: "physical", digital_rights_affirmed_at: rights },
      previewStatus: "ready",
      variants: [
        { id: "download", status: "active", fulfillmentType: "digital" },
        { id: "print", status: "active", fulfillmentType: null },
        { id: "original", status: "active", fulfillmentType: "physical" },
      ],
      assets: [
        { id: "asset-download", productVariantId: "download", active: true, versions: [readyVersion] },
      ],
    });

    expect(readiness).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("still names the download variant when its file is missing", () => {
    const readiness = resolveDigitalProductReadiness({
      product: { product_type: "physical", digital_rights_affirmed_at: rights },
      previewStatus: "ready",
      variants: [
        { id: "download", status: "active", fulfillmentType: "digital" },
        { id: "print", status: "active", fulfillmentType: null },
      ],
      assets: [],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toEqual(["variant_missing_file:download"]);
  });

  it("needs rights and a preview once any variant is a download", () => {
    const readiness = resolveDigitalProductReadiness({
      product: { product_type: "physical", digital_rights_affirmed_at: null },
      previewStatus: "missing",
      variants: [
        { id: "download", status: "active", fulfillmentType: "digital" },
        { id: "print", status: "active", fulfillmentType: null },
      ],
      assets: [
        { id: "asset-download", productVariantId: "download", active: true, versions: [readyVersion] },
      ],
    });

    expect(readiness.reasons).toEqual(["rights_missing", "preview_not_ready"]);
  });

  it("asks nothing of a digital product whose variants all ship", () => {
    // Every variant opted out, so no download is involved despite the default.
    const readiness = resolveDigitalProductReadiness({
      product: { product_type: "digital", digital_rights_affirmed_at: null },
      previewStatus: "missing",
      variants: [
        { id: "print", status: "active", fulfillmentType: "physical" },
        { id: "original", status: "active", fulfillmentType: "physical" },
      ],
      assets: [],
    });

    expect(readiness).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 0,
      previewStatus: "missing",
    });
  });

  it("ignores an archived download variant", () => {
    const readiness = resolveDigitalProductReadiness({
      product: { product_type: "physical", digital_rights_affirmed_at: rights },
      previewStatus: "ready",
      variants: [
        { id: "download", status: "archived", fulfillmentType: "digital" },
        { id: "print", status: "active", fulfillmentType: null },
      ],
      assets: [],
    });

    expect(readiness.ready).toBe(true);
  });
});
