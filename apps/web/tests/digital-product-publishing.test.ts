import { describe, expect, it, vi } from "vitest";
import {
  applyDigitalProductCatalogUpdate,
  loadDigitalProductReadiness,
  readinessFailurePayload,
} from "@/lib/digital-products/readiness-service";
import { buildDigitalPublishReadinessView } from "@/components/dashboard/product-manager-domain";

type QueryResult = { data: unknown; error: { message: string } | null };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    returns: vi.fn(async () => result),
  };
  return builder;
}

function readinessClient(input?: {
  product?: QueryResult;
  preview?: QueryResult;
  variants?: QueryResult;
  assets?: QueryResult;
}) {
  const tables: Record<string, ReturnType<typeof query>> = {
    products: query(
      input?.product ?? {
        data: {
          product_type: "digital",
          digital_rights_affirmed_at: "2026-08-12T12:00:00.000Z",
        },
        error: null,
      },
    ),
    digital_product_previews: query(
      input?.preview ?? { data: { status: "ready" }, error: null },
    ),
    product_variants: query(
      input?.variants ?? {
        data: [
          { id: "30000000-0000-4000-8000-000000000001", status: "active" },
          { id: "30000000-0000-4000-8000-000000000002", status: "active" },
        ],
        error: null,
      },
    ),
    digital_product_assets: query(
      input?.assets ?? {
        data: [
          {
            id: "60000000-0000-4000-8000-000000000001",
            product_variant_id: null,
            active: true,
            digital_product_asset_versions: [
              {
                id: "70000000-0000-4000-8000-000000000001",
                status: "ready",
                retired_at: null,
              },
            ],
          },
        ],
        error: null,
      },
    ),
  };
  return {
    from: vi.fn((table: string) => {
      const tableQuery = tables[table];
      if (!tableQuery) throw new Error(`Unexpected table ${table}`);
      return tableQuery;
    }),
    rpc: vi.fn(),
  };
}

describe("digital product publishing readiness", () => {
  it("gives the catalog a safe actionable view of structured readiness reasons", () => {
    expect(
      buildDigitalPublishReadinessView({
        ready: false,
        reasons: [
          "rights_missing",
          "preview_not_ready",
          "variant_missing_file:30000000-0000-4000-8000-000000000002",
        ],
        applicableFileCount: 1,
        previewStatus: "processing",
      }),
    ).toEqual({
      ready: false,
      applicableFileCount: 1,
      previewStatus: "processing",
      blockers: [
        "Confirm that you own or control the rights to these files.",
        "Wait for the watermarked storefront preview to finish.",
        "Attach a ready customer file to each active variant.",
      ],
    });
  });

  it("loads the owned product snapshot and accepts one ready product-wide file", async () => {
    const admin = readinessClient();

    const readiness = await loadDigitalProductReadiness({
      admin,
      storeId: "10000000-0000-4000-8000-000000000001",
      productId: "20000000-0000-4000-8000-000000000001",
    });

    expect(readiness).toEqual({
      ready: true,
      reasons: [],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("uses the proposed variant state and reports every uncovered active variant", async () => {
    const admin = readinessClient({
      assets: {
        data: [
          {
            id: "60000000-0000-4000-8000-000000000001",
            product_variant_id: "30000000-0000-4000-8000-000000000001",
            active: true,
            digital_product_asset_versions: [
              {
                id: "70000000-0000-4000-8000-000000000001",
                status: "ready",
                retired_at: null,
              },
            ],
          },
          {
            id: "60000000-0000-4000-8000-000000000002",
            product_variant_id: "30000000-0000-4000-8000-000000000002",
            active: true,
            digital_product_asset_versions: [
              {
                id: "70000000-0000-4000-8000-000000000002",
                status: "processing",
                retired_at: null,
              },
            ],
          },
        ],
        error: null,
      },
    });

    const readiness = await loadDigitalProductReadiness({
      admin,
      storeId: "10000000-0000-4000-8000-000000000001",
      productId: "20000000-0000-4000-8000-000000000001",
      proposed: {
        productType: "digital",
        rightsAffirmedAt: null,
        variants: [
          { id: "30000000-0000-4000-8000-000000000001", status: "active" },
          { id: "30000000-0000-4000-8000-000000000002", status: "active" },
        ],
      },
    });

    expect(readiness).toEqual({
      ready: false,
      reasons: [
        "rights_missing",
        "variant_missing_file:30000000-0000-4000-8000-000000000002",
      ],
      applicableFileCount: 1,
      previewStatus: "ready",
    });
  });

  it("allows a failed or processing asset when another applicable ready version remains", async () => {
    const admin = readinessClient({
      assets: {
        data: [
          {
            id: "60000000-0000-4000-8000-000000000001",
            product_variant_id: null,
            active: true,
            digital_product_asset_versions: [
              {
                id: "70000000-0000-4000-8000-000000000001",
                status: "failed",
                retired_at: null,
              },
            ],
          },
          {
            id: "60000000-0000-4000-8000-000000000002",
            product_variant_id: null,
            active: true,
            digital_product_asset_versions: [
              {
                id: "70000000-0000-4000-8000-000000000002",
                status: "ready",
                retired_at: null,
              },
            ],
          },
        ],
        error: null,
      },
    });

    await expect(
      loadDigitalProductReadiness({
        admin,
        storeId: "10000000-0000-4000-8000-000000000001",
        productId: "20000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toMatchObject({ ready: true, applicableFileCount: 1 });
  });

  it("does not invoke the mutation RPC when the proposed active state is not ready", async () => {
    const admin = readinessClient({
      preview: { data: { status: "processing" }, error: null },
    });

    const result = await applyDigitalProductCatalogUpdate({
      admin,
      storeId: "10000000-0000-4000-8000-000000000001",
      productId: "20000000-0000-4000-8000-000000000001",
      actorUserId: "00000000-0000-4000-8000-000000000001",
      currentProductType: "digital",
      nextProductType: "digital",
      nextStatus: "active",
      nextRightsAffirmedAt: "2026-08-12T12:00:00.000Z",
      variants: null,
      variantTierLevels: null,
      productUpdates: { status: "active" },
    });

    expect(result).toEqual({
      applied: false,
      reasons: ["preview_not_ready"],
      code: "digital_product_not_ready",
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("preserves structured safe reasons returned by the transactional mutation", async () => {
    const admin = readinessClient();
    admin.rpc.mockResolvedValue({
      data: {
        applied: false,
        code: "digital_product_not_ready",
        reasons: ["variant_missing_file:30000000-0000-4000-8000-000000000002"],
      },
      error: null,
    });

    const result = await applyDigitalProductCatalogUpdate({
      admin,
      storeId: "10000000-0000-4000-8000-000000000001",
      productId: "20000000-0000-4000-8000-000000000001",
      actorUserId: "00000000-0000-4000-8000-000000000001",
      currentProductType: "digital",
      nextProductType: "digital",
      nextStatus: "active",
      nextRightsAffirmedAt: "2026-08-12T12:00:00.000Z",
      variants: null,
      variantTierLevels: null,
      productUpdates: { status: "active" },
    });

    expect(result).toEqual({
      applied: false,
      code: "digital_product_not_ready",
      reasons: ["variant_missing_file:30000000-0000-4000-8000-000000000002"],
    });
    expect(readinessFailurePayload(result)).toEqual({
      error: "This digital product is not ready to publish.",
      code: "digital_product_not_ready",
      reasons: ["variant_missing_file:30000000-0000-4000-8000-000000000002"],
    });
  });
});
