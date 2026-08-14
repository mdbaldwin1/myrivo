import { randomUUID } from "node:crypto";
import { DIGITAL_ASSET_BUCKET, buildDigitalAssetStoragePath } from "./assets";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import {
  inspectStoredAssetStream,
  validateUploadDeclaration,
  type SupportedDigitalMime,
} from "./asset-validation";

type DatabaseError = { message: string; code?: string };
type DatabaseResult = { data: unknown; error: DatabaseError | null };
type StorageResult<T> = { data: T | null; error: { message: string } | null };

export type AssetAdminClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<DatabaseResult>;
  storage: {
    from(bucket: string): {
      createSignedUploadUrl(path: string): PromiseLike<StorageResult<{ signedUrl: string; token: string }>>;
      createSignedUrl(path: string, expiresIn: number): PromiseLike<StorageResult<{ signedUrl: string }>>;
      remove(paths: string[]): PromiseLike<StorageResult<unknown>>;
    };
  };
};

type IntentRow = {
  intent_id: string;
  asset_id: string;
  asset_version_id: string;
  product_id: string;
  product_variant_id: string | null;
  storage_path: string;
  expected_filename: string;
  expected_mime_type: SupportedDigitalMime;
  expected_byte_size: number;
  version_number: number;
  operation: "create" | "replace";
  intent_status: "pending" | "completed" | "failed" | "expired";
  expires_at: string;
  completed_version_id: string | null;
};

type FinalizedRow = {
  asset_id: string;
  asset_version_id: string;
  product_id: string;
  mime_type: SupportedDigitalMime;
  version_number: number;
  was_already_completed: boolean;
  finalization_status: "completed" | "already_completed" | "expired";
};

export class AssetLifecycleError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly code: string,
  ) {
    super(publicMessage);
    this.name = "AssetLifecycleError";
  }
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return data && typeof data === "object" ? (data as T) : null;
}

function throwDatabaseError(error: DatabaseError | null): never {
  const normalized = error?.message.toLowerCase() ?? "";
  if (normalized.includes("active file limit")) {
    throw new AssetLifecycleError(
      409,
      "This product already has the maximum number of files.",
      "active_file_limit",
    );
  }
  if (
    normalized.includes("one_pending_replacement") ||
    normalized.includes("replacement upload is already pending")
  ) {
    throw new AssetLifecycleError(
      409,
      "A replacement upload is already in progress.",
      "replacement_in_progress",
    );
  }
  if (normalized.includes("replacement superseded")) {
    throw new AssetLifecycleError(
      409,
      "This replacement is no longer current. Start a new upload.",
      "replacement_superseded",
    );
  }
  if (
    normalized.includes("not found") ||
    normalized.includes("does not belong") ||
    normalized.includes("unavailable")
  ) {
    throw new AssetLifecycleError(404, "Asset unavailable.", "asset_unavailable");
  }
  if (normalized.includes("expired")) {
    throw new AssetLifecycleError(409, "Upload expired. Start a new upload.", "intent_expired");
  }
  throw new AssetLifecycleError(500, "Unable to update this file.", "asset_operation_failed");
}

function validateDeclarationOrThrow(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const result = validateUploadDeclaration(input);
  if (result.ok) return result;
  throw new AssetLifecycleError(
    400,
    result.reason === "invalid_size"
      ? "File must be between 1 byte and 250 MB."
      : "Unsupported file type. Use JPG, PNG, PDF, or ZIP.",
    result.reason,
  );
}

function publicIntent(row: IntentRow, signed: { signedUrl: string; token: string }) {
  return {
    intentId: row.intent_id,
    assetId: row.asset_id,
    uploadUrl: signed.signedUrl,
    uploadToken: signed.token,
    expiresAt: row.expires_at,
  };
}

async function failIntent(
  admin: AssetAdminClient,
  storeId: string,
  intentId: string,
  reason: string,
) {
  await Promise.resolve(admin.rpc("fail_digital_asset_upload_intent", {
      p_store_id: storeId,
      p_intent_id: intentId,
      p_safe_error: reason.slice(0, 240),
    }))
    .catch(() => undefined);
}

async function expireAndRemoveIntent(
  admin: AssetAdminClient,
  storeId: string,
  intent: IntentRow,
  transition: boolean,
): Promise<never> {
  if (transition) {
    const expired = await admin.rpc("expire_digital_asset_upload_intent", {
      p_store_id: storeId,
      p_intent_id: intent.intent_id,
    });
    if (expired.error || expired.data !== true) throwDatabaseError(expired.error);
  }
  await Promise.resolve(
    admin.storage.from(DIGITAL_ASSET_BUCKET).remove([intent.storage_path]),
  ).catch(() => undefined);
  throw new AssetLifecycleError(409, "Upload expired. Start a new upload.", "intent_expired");
}

async function signIntent(admin: AssetAdminClient, storeId: string, row: IntentRow) {
  const signed = await admin.storage
    .from(DIGITAL_ASSET_BUCKET)
    .createSignedUploadUrl(row.storage_path);
  if (signed.error || !signed.data?.signedUrl || !signed.data.token) {
    await failIntent(admin, storeId, row.intent_id, "Upload signing failed");
    throw new AssetLifecycleError(500, "Unable to prepare upload.", "upload_signing_failed");
  }
  return publicIntent(row, signed.data);
}

export async function createAssetUploadIntent(input: {
  admin: AssetAdminClient;
  storeId: string;
  productId: string;
  productVariantId: string | null;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  validateDeclarationOrThrow(input);
  const intentId = randomUUID();
  const assetId = randomUUID();
  const versionId = randomUUID();
  const storagePath = buildDigitalAssetStoragePath({
    storeId: input.storeId,
    productId: input.productId,
    assetId,
    version: 1,
    fileName: input.fileName,
  });
  const expiresAt = new Date(
    Date.now() + DIGITAL_PRODUCT_CONFIG.uploadIntentTtlSeconds * 1000,
  ).toISOString();
  const { data, error } = await input.admin.rpc("create_digital_asset_upload_intent", {
    p_intent_id: intentId,
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_product_variant_id: input.productVariantId,
    p_asset_id: assetId,
    p_asset_version_id: versionId,
    p_existing_asset_id: null,
    p_label: input.label,
    p_expected_filename: input.fileName,
    p_expected_mime_type: input.mimeType,
    p_expected_byte_size: input.sizeBytes,
    p_storage_path: storagePath,
    p_operation: "create",
    p_expires_at: expiresAt,
  });
  if (error) throwDatabaseError(error);
  const row = firstRow<IntentRow>(data);
  if (!row) throwDatabaseError(null);
  return signIntent(input.admin, input.storeId, row);
}

export async function replaceAssetVersion(input: {
  admin: AssetAdminClient;
  storeId: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  validateDeclarationOrThrow(input);
  const intentId = randomUUID();
  const versionId = randomUUID();
  const { data, error } = await input.admin.rpc("create_digital_asset_upload_intent", {
    p_intent_id: intentId,
    p_store_id: input.storeId,
    p_product_id: null,
    p_product_variant_id: null,
    p_asset_id: input.assetId,
    p_asset_version_id: versionId,
    p_existing_asset_id: input.assetId,
    p_label: null,
    p_expected_filename: input.fileName,
    p_expected_mime_type: input.mimeType,
    p_expected_byte_size: input.sizeBytes,
    p_storage_path: null,
    p_operation: "replace",
    p_expires_at: new Date(
      Date.now() + DIGITAL_PRODUCT_CONFIG.uploadIntentTtlSeconds * 1000,
    ).toISOString(),
  });
  if (error) throwDatabaseError(error);
  const row = firstRow<IntentRow>(data);
  if (!row) throwDatabaseError(null);
  return signIntent(input.admin, input.storeId, row);
}

function completedResult(row: IntentRow) {
  return {
    assetId: row.asset_id,
    versionId: row.completed_version_id ?? row.asset_version_id,
    productId: row.product_id,
    mimeType: row.expected_mime_type,
    versionNumber: row.version_number,
    alreadyCompleted: true,
  };
}

export async function completeAssetUpload(input: {
  admin: AssetAdminClient;
  storeId: string;
  intentId: string;
  fetcher?: typeof fetch;
}) {
  const { data, error } = await input.admin.rpc("get_digital_asset_upload_intent", {
    p_intent_id: input.intentId,
    p_store_id: input.storeId,
  });
  if (error) throwDatabaseError(error);
  const intent = firstRow<IntentRow>(data);
  if (!intent) {
    throw new AssetLifecycleError(404, "Asset unavailable.", "asset_unavailable");
  }
  if (intent.intent_status === "completed") return completedResult(intent);
  if (intent.intent_status === "expired") {
    return expireAndRemoveIntent(input.admin, input.storeId, intent, false);
  }
  if (intent.intent_status !== "pending") {
    throw new AssetLifecycleError(409, "Upload expired. Start a new upload.", "intent_expired");
  }
  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    return expireAndRemoveIntent(input.admin, input.storeId, intent, true);
  }

  try {
    const signed = await input.admin.storage
      .from(DIGITAL_ASSET_BUCKET)
      .createSignedUrl(intent.storage_path, DIGITAL_PRODUCT_CONFIG.signedDownloadTtlSeconds);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("Unable to sign stored object");
    }
    const response = await (input.fetcher ?? fetch)(signed.data.signedUrl, {
      cache: "no-store",
      redirect: "error",
    });
    const inspected = await inspectStoredAssetStream(response, {
      expectedMimeType: intent.expected_mime_type,
      expectedSizeBytes: Number(intent.expected_byte_size),
    });
    const finalized = await input.admin.rpc("finalize_digital_asset_upload_intent", {
      p_intent_id: input.intentId,
      p_store_id: input.storeId,
      p_actual_byte_size: inspected.byteSize,
      p_detected_mime_type: inspected.detectedMimeType,
      p_checksum_sha256: inspected.checksumSha256,
    });
    if (finalized.error) throwDatabaseError(finalized.error);
    const row = firstRow<FinalizedRow>(finalized.data);
    if (!row) throwDatabaseError(null);
    if (row.finalization_status === "expired") {
      return expireAndRemoveIntent(input.admin, input.storeId, intent, false);
    }
    return {
      assetId: row.asset_id,
      versionId: row.asset_version_id,
      productId: row.product_id,
      mimeType: row.mime_type,
      versionNumber: row.version_number,
      alreadyCompleted: row.was_already_completed,
    };
  } catch (error) {
    if (error instanceof AssetLifecycleError) throw error;
    await failIntent(input.admin, input.storeId, input.intentId, "Stored object verification failed");
    await Promise.resolve(
      input.admin.storage.from(DIGITAL_ASSET_BUCKET).remove([intent.storage_path]),
    ).catch(() => undefined);
    throw new AssetLifecycleError(
      400,
      "Uploaded file could not be verified. Upload it again.",
      "stored_object_invalid",
    );
  }
}

export async function retryAssetUpload(input: {
  admin: AssetAdminClient;
  storeId: string;
  intentId: string;
}) {
  const { data, error } = await input.admin.rpc("retry_digital_asset_upload_intent", {
    p_store_id: input.storeId,
    p_intent_id: input.intentId,
    p_expires_at: new Date(
      Date.now() + DIGITAL_PRODUCT_CONFIG.uploadIntentTtlSeconds * 1000,
    ).toISOString(),
  });
  if (error) throwDatabaseError(error);
  const row = firstRow<IntentRow>(data);
  if (!row) throwDatabaseError(null);
  return signIntent(input.admin, input.storeId, row);
}

export async function updateAsset(input: {
  admin: AssetAdminClient;
  storeId: string;
  assetId: string;
  label?: string;
  productVariantId?: string | null;
}) {
  const { data, error } = await input.admin.rpc("update_digital_product_asset", {
    p_store_id: input.storeId,
    p_asset_id: input.assetId,
    p_label: input.label ?? null,
    p_set_label: input.label !== undefined,
    p_product_variant_id: input.productVariantId ?? null,
    p_set_product_variant_id: input.productVariantId !== undefined,
  });
  if (error) throwDatabaseError(error);
  const row = firstRow<Record<string, unknown>>(data);
  if (!row) throwDatabaseError(null);
  return row;
}

export async function reorderAssets(input: {
  admin: AssetAdminClient;
  storeId: string;
  productId: string;
  assetIds: string[];
}) {
  const { data, error } = await input.admin.rpc("reorder_digital_product_assets", {
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_asset_ids: input.assetIds,
  });
  if (error) throwDatabaseError(error);
  return { updatedCount: Number(data ?? 0) };
}

export async function removeAsset(input: {
  admin: AssetAdminClient;
  storeId: string;
  assetId: string;
}) {
  const { data, error } = await input.admin.rpc("deactivate_digital_product_asset", {
    p_store_id: input.storeId,
    p_asset_id: input.assetId,
  });
  if (error) throwDatabaseError(error);
  const row = firstRow<{
    deactivated: boolean;
    preserved_version_count: number;
    entitlement_count: number;
  }>(data);
  if (!row) throwDatabaseError(null);
  return {
    deactivated: row.deactivated,
    preservedVersionCount: Number(row.preserved_version_count),
    entitlementCount: Number(row.entitlement_count),
  };
}
