import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  buildTiledWatermarkSvg,
  processPreview,
  renderWatermarkedPreview,
  setPreviewOverride,
} from "@/lib/digital-products/preview-service";

const STORE_ID = "10000000-0000-0000-0000-000000000001";
const PRODUCT_ID = "20000000-0000-0000-0000-000000000001";
const VERSION_ID = "70000000-0000-0000-0000-000000000001";

async function imageResponse(width = 2400, height = 1200) {
  const input = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 34, g: 67, b: 101 },
    },
  })
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(input), {
    headers: { "content-type": "image/png" },
  });
}

describe("bounded watermarked preview rendering", () => {
  it("tiles XML-escaped store text over the resized output dimensions", () => {
    const svg = buildTiledWatermarkSvg("Art <&> \"Rachel\"", 800, 400).toString();
    expect(svg).toContain("Art &lt;&amp;&gt; &quot;Rachel&quot;");
    expect(svg).not.toContain("Art <&>");
    expect((svg.match(/<text /g) ?? []).length).toBeGreaterThan(1);
  });

  it("uses bounded resized dimensions and strips original metadata", async () => {
    const source = await imageResponse();
    const result = await renderWatermarkedPreview(source, {
      storeName: "Rachel's Studio",
      maxEdgePixels: 700,
      maxInputPixels: 4_000_000,
      jpegQuality: 78,
      maxSourceBytes: 5_000_000,
    });
    const metadata = await sharp(result.bytes).metadata();

    expect(result.width).toBe(700);
    expect(result.height).toBe(350);
    expect(metadata.width).toBe(700);
    expect(metadata.height).toBe(350);
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("rejects a source whose decompressed pixel count exceeds the configured bound", async () => {
    await expect(
      renderWatermarkedPreview(await imageResponse(200, 200), {
        storeName: "Studio",
        maxEdgePixels: 100,
        maxInputPixels: 10_000,
        jpegQuality: 78,
        maxSourceBytes: 5_000_000,
      }),
    ).rejects.toMatchObject({ code: "preview_source_too_large" });
  });

  it("rejects an unavailable source before initializing the image pipeline", async () => {
    await expect(
      renderWatermarkedPreview(new Response(null, { status: 404 }), {
        storeName: "Studio",
      }),
    ).rejects.toMatchObject({ code: "preview_source_unavailable" });
  });
});

describe("preview lifecycle", () => {
  it("returns in-progress without fetching when another processor holds the lease", async () => {
    const fetcher = vi.fn();
    const admin = {
      rpc: vi.fn(async () => ({
        data: [
          {
            preview_status: "processing",
            public_preview_path: null,
            source_storage_path: "private/source.png",
            source_mime_type: "image/png",
            was_already_ready: false,
            processing_acquired: false,
            processing_generation: null,
          },
        ],
        error: null,
      })),
      storage: { from: vi.fn() },
    };

    await expect(
      processPreview({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceAssetVersionId: VERSION_ID,
        storeName: "Studio",
        fetcher,
      }),
    ).resolves.toEqual({ status: "processing", inProgress: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(admin.storage.from).not.toHaveBeenCalled();
  });

  it("completes only the preview generation acquired by this processor", async () => {
    const generation = "a0000000-0000-4000-8000-000000000010";
    const previewStorage = {
      upload: vi.fn(async () => ({ error: null })),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.test/${path}` },
      })),
    };
    const originalStorage = {
      createSignedUrl: vi.fn(async () => ({
        data: { signedUrl: "https://storage.test/source" },
        error: null,
      })),
    };
    const admin = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === "begin_digital_product_preview") {
          return {
            data: [
              {
                preview_status: "processing",
                public_preview_path: null,
                source_storage_path: "private/source.png",
                source_mime_type: "image/png",
                was_already_ready: false,
                processing_acquired: true,
                processing_generation: generation,
              },
            ],
            error: null,
          };
        }
        if (name === "complete_digital_product_preview") {
          expect(args.p_processing_generation).toBe(generation);
          return { data: true, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      }),
      storage: {
        from: vi.fn((bucket: string) =>
          bucket === "digital-product-assets" ? originalStorage : previewStorage,
        ),
      },
    };

    await expect(
      processPreview({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceAssetVersionId: VERSION_ID,
        storeName: "Studio",
        fetcher: vi.fn(async () => imageResponse(300, 200)),
      }),
    ).resolves.toMatchObject({ status: "ready", alreadyReady: false });
  });

  it("removes stale output without failing a preview superseded by an override", async () => {
    const generation = "a0000000-0000-4000-8000-000000000012";
    const previewStorage = {
      upload: vi.fn(async () => ({ error: null })),
      remove: vi.fn(async () => ({ error: null })),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.test/${path}` },
      })),
    };
    const originalStorage = {
      createSignedUrl: vi.fn(async () => ({
        data: { signedUrl: "https://storage.test/source" },
        error: null,
      })),
    };
    const rpcNames: string[] = [];
    const admin = {
      rpc: vi.fn(async (name: string) => {
        rpcNames.push(name);
        if (name === "begin_digital_product_preview") {
          return {
            data: [
              {
                preview_status: "processing",
                public_preview_path: null,
                source_storage_path: "private/source.png",
                source_mime_type: "image/png",
                was_already_ready: false,
                processing_acquired: true,
                processing_generation: generation,
              },
            ],
            error: null,
          };
        }
        if (name === "complete_digital_product_preview") {
          return { data: false, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      }),
      storage: {
        from: vi.fn((bucket: string) =>
          bucket === "digital-product-assets" ? originalStorage : previewStorage,
        ),
      },
    };

    await expect(
      processPreview({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceAssetVersionId: VERSION_ID,
        storeName: "Studio",
        fetcher: vi.fn(async () => imageResponse(300, 200)),
      }),
    ).rejects.toMatchObject({ status: 409, code: "preview_superseded" });
    expect(rpcNames).toEqual([
      "begin_digital_product_preview",
      "complete_digital_product_preview",
    ]);
    expect(previewStorage.remove).toHaveBeenCalledWith([
      `${STORE_ID}/${PRODUCT_ID}/watermarked-${VERSION_ID}.jpg`,
    ]);
  });

  it("is idempotent when the same source preview is already ready", async () => {
    const fetcher = vi.fn();
    const admin = {
      rpc: vi.fn(async (name: string) => {
        expect(name).toBe("begin_digital_product_preview");
        return {
          data: [
            {
              preview_status: "ready",
              public_preview_path: `${STORE_ID}/${PRODUCT_ID}/watermarked-${VERSION_ID}.jpg`,
              source_storage_path: "private/source.png",
              source_mime_type: "image/png",
              was_already_ready: true,
              processing_acquired: false,
              processing_generation: null,
            },
          ],
          error: null,
        };
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.test/${path}` },
          })),
        })),
      },
    };

    const result = await processPreview({
      admin,
      storeId: STORE_ID,
      productId: PRODUCT_ID,
      sourceAssetVersionId: VERSION_ID,
      storeName: "Studio",
      fetcher,
    });

    expect(result).toMatchObject({ status: "ready", alreadyReady: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires a separate public preview for PDF and ZIP originals", async () => {
    const admin = {
      rpc: vi.fn(async () => ({
        data: [
          {
            preview_status: "processing",
            public_preview_path: null,
            source_storage_path: "private/source.pdf",
            source_mime_type: "application/pdf",
            was_already_ready: false,
            processing_acquired: true,
            processing_generation: "a0000000-0000-4000-8000-000000000011",
          },
        ],
        error: null,
      })),
      storage: { from: vi.fn() },
    };
    await expect(
      processPreview({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceAssetVersionId: VERSION_ID,
        storeName: "Studio",
      }),
    ).rejects.toMatchObject({
      status: 409,
      publicMessage: "Upload a separate storefront preview image for this file type.",
    });
  });

  it("copies only a same-store public product image into a stable preview path", async () => {
    const sourceUrl = `https://project.supabase.co/storage/v1/object/public/store-products/${STORE_ID}/products/source.png`;
    const calls: string[] = [];
    const previewStorage = {
      upload: vi.fn(async (path: string) => {
        calls.push(`upload:${path}`);
        return { error: null };
      }),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.test/${path}` },
      })),
    };
    const sourceStorage = {
      list: vi.fn(async () => ({ data: [{ name: "source.png" }], error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: sourceUrl } })),
    };
    const admin = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        calls.push(name);
        if (name === "validate_digital_preview_override") {
          expect(args).toMatchObject({
            p_store_id: STORE_ID,
            p_product_id: PRODUCT_ID,
            p_source_url: sourceUrl,
          });
          return { data: true, error: null };
        }
        if (name === "complete_digital_preview_override") {
          expect(String(args.p_public_preview_path)).toMatch(
            new RegExp(`^${STORE_ID}/${PRODUCT_ID}/merchant-override-[a-f0-9]{64}\\.jpg$`),
          );
          return { data: true, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      }),
      storage: {
        from: vi.fn((bucket: string) =>
          bucket === "store-products" ? sourceStorage : previewStorage,
        ),
      },
    };

    const result = await setPreviewOverride({
      admin,
      storeId: STORE_ID,
      productId: PRODUCT_ID,
      sourceUrl,
      storeName: "Studio",
      fetcher: vi.fn(async () => imageResponse(300, 200)),
    });
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.test\//);
    expect(result).not.toHaveProperty("sourceUrl");
    expect(calls).toEqual([
      "validate_digital_preview_override",
      expect.stringMatching(/^upload:/),
      "complete_digital_preview_override",
    ]);
  });

  it("rejects a public image URL belonging to another store without revealing ownership", async () => {
    const admin = {
      rpc: vi.fn(async () => ({ data: false, error: null })),
      storage: { from: vi.fn() },
    };
    await expect(
      setPreviewOverride({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceUrl:
          "https://project.supabase.co/storage/v1/object/public/store-products/other-store/products/source.png",
        storeName: "Studio",
      }),
    ).rejects.toMatchObject({ status: 404, publicMessage: "Preview image unavailable." });
  });

  it("never fetches a lookalike URL on an untrusted host", async () => {
    const maliciousUrl = `https://attacker.test/storage/v1/object/public/store-products/${STORE_ID}/products/source.png`;
    const canonicalUrl = `https://project.supabase.co/storage/v1/object/public/store-products/${STORE_ID}/products/source.png`;
    const fetcher = vi.fn();
    const admin = {
      rpc: vi.fn(async () => ({ data: true, error: null })),
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async () => ({ data: [{ name: "source.png" }], error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: canonicalUrl } })),
        })),
      },
    };

    await expect(
      setPreviewOverride({
        admin,
        storeId: STORE_ID,
        productId: PRODUCT_ID,
        sourceUrl: maliciousUrl,
        storeName: "Studio",
        fetcher,
      }),
    ).rejects.toMatchObject({ status: 404, publicMessage: "Preview image unavailable." });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
