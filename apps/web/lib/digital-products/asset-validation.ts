import { createHash } from "node:crypto";
import { DIGITAL_PRODUCT_CONFIG } from "./config";

export type SupportedDigitalMime =
  | "image/jpeg"
  | "image/png"
  | "application/pdf"
  | "application/zip";

export class StoredAssetValidationError extends Error {
  constructor(
    readonly code:
      | "stored_object_unavailable"
      | "stored_metadata_mismatch"
      | "stored_size_mismatch"
      | "stored_object_too_large"
      | "content_signature_mismatch",
  ) {
    super("Uploaded file could not be verified.");
    this.name = "StoredAssetValidationError";
  }
}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

export function validateUploadDeclaration(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const extension = extensionOf(input.fileName) as keyof typeof DIGITAL_PRODUCT_CONFIG.acceptedFiles;
  if (DIGITAL_PRODUCT_CONFIG.acceptedFiles[extension] !== input.mimeType) {
    return { ok: false as const, reason: "unsupported_type" as const };
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > DIGITAL_PRODUCT_CONFIG.maxFileBytes
  ) {
    return { ok: false as const, reason: "invalid_size" as const };
  }
  return {
    ok: true as const,
    mimeType: input.mimeType as SupportedDigitalMime,
    extension,
  };
}

function detectMimeType(signature: Uint8Array): SupportedDigitalMime | null {
  if (
    signature.length >= 3 &&
    signature[0] === 0xff &&
    signature[1] === 0xd8 &&
    signature[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    signature.length >= 8 &&
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47 &&
    signature[4] === 0x0d &&
    signature[5] === 0x0a &&
    signature[6] === 0x1a &&
    signature[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    signature.length >= 5 &&
    signature[0] === 0x25 &&
    signature[1] === 0x50 &&
    signature[2] === 0x44 &&
    signature[3] === 0x46 &&
    signature[4] === 0x2d
  ) {
    return "application/pdf";
  }
  if (
    signature.length >= 4 &&
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    ((signature[2] === 0x03 && signature[3] === 0x04) ||
      (signature[2] === 0x05 && signature[3] === 0x06) ||
      (signature[2] === 0x07 && signature[3] === 0x08))
  ) {
    return "application/zip";
  }
  return null;
}

export async function inspectStoredAssetStream(
  response: Response,
  expected: {
    expectedMimeType: SupportedDigitalMime;
    expectedSizeBytes: number;
    maxBytes?: number;
  },
) {
  if (!response.ok || !response.body) {
    throw new StoredAssetValidationError("stored_object_unavailable");
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== expected.expectedMimeType) {
    await response.body.cancel().catch(() => undefined);
    throw new StoredAssetValidationError("stored_metadata_mismatch");
  }

  const maxBytes = expected.maxBytes ?? DIGITAL_PRODUCT_CONFIG.maxFileBytes;
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new StoredAssetValidationError("stored_object_too_large");
  }

  const reader = response.body.getReader();
  const hash = createHash("sha256");
  const signature = new Uint8Array(8);
  let signatureLength = 0;
  let byteSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteSize += value.byteLength;
      if (byteSize > maxBytes) {
        await reader.cancel();
        throw new StoredAssetValidationError("stored_object_too_large");
      }
      hash.update(value);
      if (signatureLength < signature.length) {
        const length = Math.min(value.length, signature.length - signatureLength);
        signature.set(value.subarray(0, length), signatureLength);
        signatureLength += length;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (byteSize !== expected.expectedSizeBytes) {
    throw new StoredAssetValidationError("stored_size_mismatch");
  }
  const detectedMimeType = detectMimeType(signature.subarray(0, signatureLength));
  if (detectedMimeType !== expected.expectedMimeType) {
    throw new StoredAssetValidationError("content_signature_mismatch");
  }

  return {
    byteSize,
    checksumSha256: hash.digest("hex"),
    detectedMimeType,
  };
}
