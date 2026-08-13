import { createHash } from "node:crypto";
import sharp from "sharp";
import { DIGITAL_ASSET_BUCKET, DIGITAL_PREVIEW_BUCKET } from "./assets";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import type { AssetAdminClient } from "./asset-service";

type PreviewStorage = {
  createSignedUrl?: (
    path: string,
    expiresIn: number,
  ) => PromiseLike<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  upload?: (
    path: string,
    body: Uint8Array,
    options: { contentType: string; cacheControl: string; upsert: boolean },
  ) => PromiseLike<{ data?: unknown; error: { message: string } | null }>;
  getPublicUrl?: (path: string) => { data: { publicUrl: string } };
  list?: (
    path: string,
    options: { search: string; limit: number },
  ) => PromiseLike<{ data: Array<{ name: string }> | null; error: { message: string } | null }>;
  remove?: (
    paths: string[],
  ) => PromiseLike<{ data?: unknown; error: { message: string } | null }>;
};

export type PreviewAdminClient = Omit<AssetAdminClient, "storage"> & {
  storage: { from(bucket: string): PreviewStorage };
};

type PreviewBeginRow = {
  preview_status: "processing" | "ready";
  public_preview_path: string | null;
  source_storage_path: string;
  source_mime_type: string;
  was_already_ready: boolean;
  processing_acquired: boolean;
  processing_generation: string | null;
};

export class PreviewLifecycleError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly code: string,
  ) {
    super(publicMessage);
    this.name = "PreviewLifecycleError";
  }
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return data && typeof data === "object" ? (data as T) : null;
}

function escapeXmlText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .slice(0, 120);
}

export function buildTiledWatermarkSvg(storeName: string, width: number, height: number) {
  const safeName = escapeXmlText(storeName.trim() || "Store preview");
  const columns = Math.max(2, Math.ceil(width / 360));
  const rows = Math.max(2, Math.ceil(height / 220));
  const labels = Array.from({ length: columns * rows }, (_, index) => {
    const x = ((index % columns) + 0.5) * (width / columns);
    const y = (Math.floor(index / columns) + 0.5) * (height / rows);
    return `<text x="${x}" y="${y}">${safeName}</text>`;
  }).join("");
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{fill:#fff;fill-opacity:.44;font:600 28px sans-serif;text-anchor:middle;paint-order:stroke;stroke:#000;stroke-opacity:.16;stroke-width:2px}</style><g transform="rotate(-24 ${width / 2} ${height / 2})">${labels}</g></svg>`,
  );
}

async function writeResponseIntoSharp(
  response: Response,
  transformer: sharp.Sharp,
  maxSourceBytes: number,
) {
  if (!response.ok || !response.body) {
    throw new PreviewLifecycleError(400, "Preview source could not be read.", "preview_source_unavailable");
  }
  const reader = response.body.getReader();
  let sourceBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sourceBytes += value.byteLength;
      if (sourceBytes > maxSourceBytes) {
        await reader.cancel();
        throw new PreviewLifecycleError(400, "Preview source is too large.", "preview_source_too_large");
      }
      if (!transformer.write(Buffer.from(value))) {
        await new Promise<void>((resolve, reject) => {
          transformer.once("drain", resolve);
          transformer.once("error", reject);
        });
      }
    }
    transformer.end();
  } finally {
    reader.releaseLock();
  }
}

export async function renderWatermarkedPreview(
  response: Response,
  options: {
    storeName: string;
    maxEdgePixels?: number;
    maxInputPixels?: number;
    jpegQuality?: number;
    maxSourceBytes?: number;
  },
) {
  if (!response.ok || !response.body) {
    throw new PreviewLifecycleError(
      400,
      "Preview source could not be read.",
      "preview_source_unavailable",
    );
  }
  const maxEdgePixels = options.maxEdgePixels ?? DIGITAL_PRODUCT_CONFIG.previewMaxEdgePixels;
  const maxInputPixels = options.maxInputPixels ?? DIGITAL_PRODUCT_CONFIG.previewMaxInputPixels;
  const maxSourceBytes = options.maxSourceBytes ?? DIGITAL_PRODUCT_CONFIG.previewMaxSourceBytes;
  const jpegQuality = options.jpegQuality ?? DIGITAL_PRODUCT_CONFIG.previewJpegQuality;
  const resize = sharp({
    failOn: "error",
    limitInputPixels: maxInputPixels,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: maxEdgePixels,
      height: maxEdgePixels,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: jpegQuality, mozjpeg: true });
  const resizedPromise = resize.toBuffer({ resolveWithObject: true });

  try {
    await writeResponseIntoSharp(response, resize, maxSourceBytes);
    const resized = await resizedPromise;
    const width = resized.info.width;
    const height = resized.info.height;
    if (!width || !height || width * height > maxEdgePixels * maxEdgePixels) {
      throw new PreviewLifecycleError(400, "Preview source is too large.", "preview_source_too_large");
    }
    const bytes = await sharp(resized.data, {
      failOn: "error",
      limitInputPixels: maxEdgePixels * maxEdgePixels,
    })
      .composite([
        {
          input: buildTiledWatermarkSvg(options.storeName, width, height),
          blend: "over",
        },
      ])
      .jpeg({ quality: jpegQuality, mozjpeg: true })
      .toBuffer();
    return { bytes, width, height };
  } catch (error) {
    resize.destroy();
    await resizedPromise.catch(() => undefined);
    if (error instanceof PreviewLifecycleError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("pixel limit") || message.includes("image exceeds")) {
      throw new PreviewLifecycleError(400, "Preview source is too large.", "preview_source_too_large");
    }
    throw new PreviewLifecycleError(400, "Preview source could not be processed.", "preview_processing_failed");
  }
}

async function markPreviewFailed(
  admin: PreviewAdminClient,
  storeId: string,
  productId: string,
  processingGeneration: string,
  safeError: string,
) {
  await Promise.resolve(admin.rpc("fail_digital_product_preview", {
      p_store_id: storeId,
      p_product_id: productId,
      p_processing_generation: processingGeneration,
      p_safe_error: safeError.slice(0, 240),
    }))
    .catch(() => undefined);
}

export async function processPreview(input: {
  admin: PreviewAdminClient;
  storeId: string;
  productId: string;
  sourceAssetVersionId: string;
  storeName: string;
  fetcher?: typeof fetch;
}) {
  const begun = await input.admin.rpc("begin_digital_product_preview", {
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_source_asset_version_id: input.sourceAssetVersionId,
  });
  if (begun.error) {
    throw new PreviewLifecycleError(404, "Preview source unavailable.", "preview_source_unavailable");
  }
  const row = firstRow<PreviewBeginRow>(begun.data);
  if (!row) {
    throw new PreviewLifecycleError(404, "Preview source unavailable.", "preview_source_unavailable");
  }
  if (row.was_already_ready && row.public_preview_path) {
    const publicUrl = input.admin.storage
      .from(DIGITAL_PREVIEW_BUCKET)
      .getPublicUrl?.(row.public_preview_path).data.publicUrl;
    return { status: "ready" as const, publicUrl: publicUrl ?? null, alreadyReady: true };
  }
  if (!row.processing_acquired) {
    return { status: "processing" as const, inProgress: true };
  }
  if (!row.processing_generation) {
    throw new PreviewLifecycleError(500, "Unable to create preview.", "preview_processing_failed");
  }
  const processingGeneration = row.processing_generation;
  if (row.source_mime_type !== "image/jpeg" && row.source_mime_type !== "image/png") {
    await markPreviewFailed(
      input.admin,
      input.storeId,
      input.productId,
      processingGeneration,
      "Separate preview image required",
    );
    throw new PreviewLifecycleError(
      409,
      "Upload a separate storefront preview image for this file type.",
      "separate_preview_required",
    );
  }

  try {
    const originals = input.admin.storage.from(DIGITAL_ASSET_BUCKET);
    const signed = await originals.createSignedUrl?.(
      row.source_storage_path,
      DIGITAL_PRODUCT_CONFIG.signedDownloadTtlSeconds,
    );
    if (!signed || signed.error || !signed.data?.signedUrl) throw new Error("Signing failed");
    const response = await (input.fetcher ?? fetch)(signed.data.signedUrl, {
      cache: "no-store",
      redirect: "error",
    });
    const rendered = await renderWatermarkedPreview(response, {
      storeName: input.storeName,
    });
    const publicPath = `${input.storeId}/${input.productId}/watermarked-${input.sourceAssetVersionId}-${processingGeneration}.jpg`;
    const previews = input.admin.storage.from(DIGITAL_PREVIEW_BUCKET);
    const uploaded = await previews.upload?.(publicPath, rendered.bytes, {
      contentType: "image/jpeg",
      cacheControl: "31536000, immutable",
      upsert: true,
    });
    if (!uploaded || uploaded.error) throw new Error("Preview upload failed");
    const completed = await input.admin.rpc("complete_digital_product_preview", {
      p_store_id: input.storeId,
      p_product_id: input.productId,
      p_source_asset_version_id: input.sourceAssetVersionId,
      p_public_preview_path: publicPath,
      p_processing_generation: processingGeneration,
    });
    if (completed.error) throw new Error("Preview persistence failed");
    if (completed.data !== true) {
      await Promise.resolve(previews.remove?.([publicPath])).catch(() => undefined);
      throw new PreviewLifecycleError(
        409,
        "Preview generation was superseded.",
        "preview_superseded",
      );
    }
    return {
      status: "ready" as const,
      publicUrl: previews.getPublicUrl?.(publicPath).data.publicUrl ?? null,
      alreadyReady: false,
    };
  } catch (error) {
    if (!(error instanceof PreviewLifecycleError && error.code === "preview_superseded")) {
      await markPreviewFailed(
        input.admin,
        input.storeId,
        input.productId,
        processingGeneration,
        "Preview processing failed",
      );
    }
    if (error instanceof PreviewLifecycleError) throw error;
    throw new PreviewLifecycleError(500, "Unable to create preview.", "preview_processing_failed");
  }
}

function parsePublicProductImage(sourceUrl: string, storeId: string) {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const marker = "/storage/v1/object/public/store-products/";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return null;
  const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  if (!path.startsWith(`${storeId}/`) || path.includes("..")) return null;
  const slash = path.lastIndexOf("/");
  if (slash < 0) return null;
  return { path, directory: path.slice(0, slash), name: path.slice(slash + 1), normalizedUrl: url.origin + url.pathname };
}

export async function setPreviewOverride(input: {
  admin: PreviewAdminClient;
  storeId: string;
  productId: string;
  sourceUrl: string;
  storeName: string;
  fetcher?: typeof fetch;
}) {
  const source = parsePublicProductImage(input.sourceUrl, input.storeId);
  if (!source) {
    throw new PreviewLifecycleError(404, "Preview image unavailable.", "preview_source_unavailable");
  }
  const validation = await input.admin.rpc("validate_digital_preview_override", {
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_source_url: source.normalizedUrl,
  });
  if (validation.error || validation.data !== true) {
    throw new PreviewLifecycleError(404, "Preview image unavailable.", "preview_source_unavailable");
  }
  const sourceStorage = input.admin.storage.from("store-products");
  const listed = await sourceStorage.list?.(source.directory, { search: source.name, limit: 2 });
  if (!listed || listed.error || !listed.data?.some((object) => object.name === source.name)) {
    throw new PreviewLifecycleError(404, "Preview image unavailable.", "preview_source_unavailable");
  }
  const canonicalUrl = sourceStorage.getPublicUrl?.(source.path).data.publicUrl;
  const canonicalSource = canonicalUrl
    ? parsePublicProductImage(canonicalUrl, input.storeId)
    : null;
  if (!canonicalSource || canonicalSource.normalizedUrl !== source.normalizedUrl) {
    throw new PreviewLifecycleError(404, "Preview image unavailable.", "preview_source_unavailable");
  }

  try {
    const response = await (input.fetcher ?? fetch)(canonicalSource.normalizedUrl, {
      cache: "no-store",
      redirect: "error",
    });
    const rendered = await renderWatermarkedPreview(response, {
      storeName: input.storeName,
      maxSourceBytes: DIGITAL_PRODUCT_CONFIG.previewOverrideMaxSourceBytes,
    });
    const digest = createHash("sha256").update(canonicalSource.normalizedUrl).digest("hex");
    const publicPath = `${input.storeId}/${input.productId}/merchant-override-${digest}.jpg`;
    const previews = input.admin.storage.from(DIGITAL_PREVIEW_BUCKET);
    const uploaded = await previews.upload?.(publicPath, rendered.bytes, {
      contentType: "image/jpeg",
      cacheControl: "31536000, immutable",
      upsert: true,
    });
    if (!uploaded || uploaded.error) throw new Error("Preview upload failed");
    const completed = await input.admin.rpc("complete_digital_preview_override", {
      p_store_id: input.storeId,
      p_product_id: input.productId,
      p_public_preview_path: publicPath,
    });
    if (completed.error) throw new Error("Preview persistence failed");
    return { publicUrl: previews.getPublicUrl?.(publicPath).data.publicUrl ?? null };
  } catch (error) {
    if (error instanceof PreviewLifecycleError) throw error;
    throw new PreviewLifecycleError(500, "Unable to set preview image.", "preview_override_failed");
  }
}
