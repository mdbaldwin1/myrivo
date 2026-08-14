import { randomUUID } from "node:crypto";
import { DIGITAL_PRODUCT_CONFIG } from "./config";

export const DIGITAL_ASSET_BUCKET = "digital-product-assets";
export const DIGITAL_PREVIEW_BUCKET = "digital-product-previews";

export function validateDigitalAssetUpload(input: { fileName: string; mimeType: string; sizeBytes: number }) {
  const extension = `.${input.fileName.split(".").pop()?.toLowerCase() ?? ""}` as keyof typeof DIGITAL_PRODUCT_CONFIG.acceptedFiles;
  if (DIGITAL_PRODUCT_CONFIG.acceptedFiles[extension] !== input.mimeType) {
    return { ok: false as const, error: "Unsupported file type. Use JPG, PNG, PDF, or ZIP." };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > DIGITAL_PRODUCT_CONFIG.maxFileBytes) {
    return { ok: false as const, error: "File must be 250 MB or smaller." };
  }
  return { ok: true as const };
}

export function buildDigitalAssetStoragePath(input: { storeId: string; productId: string; assetId: string; version: number; fileName: string }) {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const base = input.fileName.slice(0, -(extension.length + 1)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "download";
  return `${input.storeId}/${input.productId}/${input.assetId}/v${input.version}/${base}.${extension}`;
}

export function newDigitalAssetId() {
  return randomUUID();
}

export function buildWatermarkSvg(storeName: string, width: number, height: number) {
  const safeName = storeName.replace(/[<>&"']/g, "");
  const columns = Math.max(2, Math.ceil(width / 360));
  const rows = Math.max(2, Math.ceil(height / 220));
  const labels = Array.from({ length: columns * rows }, (_, index) => {
    const x = ((index % columns) + 0.5) * (width / columns);
    const y = (Math.floor(index / columns) + 0.5) * (height / rows);
    return `<text x="${x}" y="${y}">${safeName}</text>`;
  }).join("");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{fill:white;fill-opacity:.42;font:600 28px sans-serif;text-anchor:middle}</style><g transform="rotate(-24 ${width / 2} ${height / 2})">${labels}</g></svg>`);
}
