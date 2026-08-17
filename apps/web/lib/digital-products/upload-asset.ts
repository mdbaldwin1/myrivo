import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";

/**
 * Attaching a customer download is three steps: the server reserves the asset
 * and hands back a signed URL, the bytes go straight to storage, and the server
 * verifies what landed. The editor drives this both for files added to a saved
 * variant and for files staged against a variant that did not exist yet.
 */

export function parseUploadError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export function digitalFileLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Customer file";
}

export function validateDigitalFile(file: File) {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}` as keyof typeof DIGITAL_PRODUCT_CONFIG.acceptedFiles;
  if (DIGITAL_PRODUCT_CONFIG.acceptedFiles[extension] !== file.type) {
    return "Unsupported file type. Use JPG, PNG, PDF, or ZIP.";
  }
  if (file.size <= 0 || file.size > DIGITAL_PRODUCT_CONFIG.maxFileBytes) {
    return "File must be between 1 byte and 250 MB.";
  }
  return null;
}

export type DigitalAssetUploadResult = { ok: true; assetId: string } | { ok: false; message: string };

export async function uploadDigitalAsset(input: {
  productId: string;
  productVariantId: string | null;
  label: string;
  file: File;
  signal?: AbortSignal;
}): Promise<DigitalAssetUploadResult> {
  const intentResponse = await fetch("/api/products/digital-assets/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: input.productId,
      productVariantId: input.productVariantId,
      label: input.label,
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    }),
    signal: input.signal,
  });
  const intentPayload = await readJson(intentResponse);
  if (!intentResponse.ok || !intentPayload || typeof intentPayload !== "object") {
    return { ok: false, message: parseUploadError(intentPayload, "Unable to prepare upload.") };
  }
  const intent = intentPayload as { intentId: string; assetId: string; uploadUrl: string };

  const direct = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": input.file.type },
    body: input.file,
    signal: input.signal,
  });
  if (!direct.ok) {
    return { ok: false, message: "The file could not be uploaded. Try again." };
  }

  const completeResponse = await fetch("/api/products/digital-assets/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intentId: intent.intentId }),
    signal: input.signal,
  });
  if (!completeResponse.ok) {
    const completePayload = await readJson(completeResponse);
    return { ok: false, message: parseUploadError(completePayload, "The uploaded file could not be verified.") };
  }
  return { ok: true, assetId: intent.assetId };
}
