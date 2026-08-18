"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DigitalProductFileRow } from "@/components/dashboard/digital-product-file-row";
import { Lister, ListerEmpty, ListerRows } from "@/components/dashboard/lister";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { HintTooltip } from "@/components/ui/tooltip";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { digitalFileLabel as fileLabel, validateDigitalFile as validateFile } from "@/lib/digital-products/upload-asset";
import { notify } from "@/lib/feedback/toast";

export type DigitalAssetVersion = {
  id: string;
  customer_filename: string;
  mime_type: string;
  byte_size: number;
  status: "uploading" | "processing" | "ready" | "failed";
  failure_reason: string | null;
  version_number: number;
  created_at: string;
  retired_at: string | null;
};

export type DigitalProductAsset = {
  id: string;
  label: string;
  product_variant_id: string | null;
  sort_order: number;
  active: boolean;
  digital_product_asset_versions: DigitalAssetVersion[];
};

export type PersistedFailedUpload = {
  id: string;
  asset_id: string;
  operation: "create" | "replace";
  label: string;
  expected_filename: string;
  expected_mime_type: string;
  expected_byte_size: number;
  product_variant_id: string | null;
  last_safe_error: string;
  version_number: number;
  updated_at: string;
};

export type DigitalProductFileVariant = {
  id: string;
  label: string;
  status: "active" | "archived";
};

type UploadIntent = {
  intentId: string;
  assetId: string;
  uploadUrl: string;
};

type UploadJob = {
  id: string;
  file: File;
  label: string;
  progress: number;
  phase: "preparing" | "uploading" | "verifying" | "failed";
  message: string;
  intentId: string | null;
};

type PendingConfirmation =
  | { type: "replace"; asset: DigitalProductAsset; file: File; returnFocus: HTMLButtonElement | null }
  | { type: "remove"; asset: DigitalProductAsset }
  | { type: "rights"; fileName: string }
  | null;

type DigitalProductFilesProps = {
  productId: string;
  variants?: DigitalProductFileVariant[];
  focusTarget?: string | null;
  onCatalogChange?: (signal?: AbortSignal) => void | Promise<void>;
  /**
   * Locks this list to one sellable unit, matching where the SKU for that unit
   * is edited: the product itself when it has no variants, otherwise the
   * variant or option being edited. Undefined keeps the unscoped list.
   */
  scope?: { productVariantId: string | null };
  /** Reports every asset on the product, so the editor can tell which units
      already carry files and must not be restructured underneath them. */
  onAssetsChange?: (assets: DigitalProductAsset[]) => void;
  /** Storefront images available to stand in as the buyer preview. */
  productImageUrls?: string[];
  /** Whether the merchant has affirmed the right to sell this product's files. */
  rightsAffirmed?: boolean;
};

function parseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

async function responseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}


function isAbortError(error: unknown, signal: AbortSignal) {
  return signal.aborted || (error instanceof Error && error.name === "AbortError");
}

function sortAssets(assets: DigitalProductAsset[]) {
  return [...assets].sort((left, right) => left.sort_order - right.sort_order);
}

export function DigitalProductFiles({ productId, variants = [], focusTarget, onCatalogChange, scope, productImageUrls = [], rightsAffirmed = true, onAssetsChange }: DigitalProductFilesProps) {
  const [assets, setAssets] = useState<DigitalProductAsset[]>([]);
  const [failedUploads, setFailedUploads] = useState<PersistedFailedUpload[]>([]);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAssetIds, setBusyAssetIds] = useState<Set<string>>(new Set());
  const [busyFailedIntentIds, setBusyFailedIntentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [uploadScope, setUploadScope] = useState<string>("all");
  const errorRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const currentProductIdRef = useRef(productId);
  const operationControllersRef = useRef<Set<AbortController>>(new Set());
  currentProductIdRef.current = productId;

  function beginOperation() {
    const controller = new AbortController();
    operationControllersRef.current.add(controller);
    return controller;
  }

  function finishOperation(controller: AbortController) {
    operationControllersRef.current.delete(controller);
  }

  async function affirmRights() {
    const controller = beginOperation();
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, digitalRightsAffirmed: true }),
        signal: controller.signal,
      });
      if (!response.ok) {
        showError(parseError(await responseJson(response), "Unable to record your rights confirmation."));
        return;
      }
      notify.success("Rights confirmed for this product.");
      await onCatalogChange?.(controller.signal);
    } catch (affirmError) {
      if (isAbortError(affirmError, controller.signal)) return;
      showError(affirmError instanceof Error ? affirmError.message : "Unable to record your rights confirmation.");
    } finally {
      finishOperation(controller);
    }
  }

  const showError = useCallback((message: string) => {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  const loadAssets = useCallback(async (signal?: AbortSignal) => {
    const requestedProductId = productId;
    const response = await fetch(`/api/products/digital-assets?productId=${encodeURIComponent(productId)}`, { signal });
    const payload = await responseJson(response);
    if (currentProductIdRef.current !== requestedProductId) return null;
    if (!response.ok) {
      throw new Error(parseError(payload, "Unable to load customer files."));
    }
    const next = sortAssets(
      payload && typeof payload === "object" && Array.isArray((payload as { assets?: unknown }).assets)
        ? ((payload as { assets: DigitalProductAsset[] }).assets ?? [])
        : [],
    );
    const nextFailedUploads =
      payload && typeof payload === "object" && Array.isArray((payload as { failedUploads?: unknown }).failedUploads)
        ? ((payload as { failedUploads: PersistedFailedUpload[] }).failedUploads ?? [])
        : [];
    setAssets(next);
    setFailedUploads(nextFailedUploads);
    return { assets: next, failedUploads: nextFailedUploads };
  }, [productId]);

  useEffect(() => {
    const controller = new AbortController();
    const operationControllers = operationControllersRef.current;
    operationControllers.add(controller);
    let active = true;
    currentProductIdRef.current = productId;
    setAssets([]);
    setFailedUploads([]);
    setUploads([]);
    setBusyAssetIds(new Set());
    setBusyFailedIntentIds(new Set());
    setPendingConfirmation(null);
    setUploadScope("all");
    setError(null);
    setLoading(true);
    void loadAssets(controller.signal)
      .catch((loadError) => {
        if (active && !controller.signal.aborted) showError(loadError instanceof Error ? loadError.message : "Unable to load customer files.");
      })
      .finally(() => {
        operationControllers.delete(controller);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      for (const operationController of operationControllers) operationController.abort();
      operationControllers.clear();
      if (currentProductIdRef.current === productId) currentProductIdRef.current = "";
    };
  }, [loadAssets, productId, showError]);

  useEffect(() => {
    if (!focusTarget) return;
    if (variants.some((variant) => variant.id === focusTarget)) setUploadScope(focusTarget);
    window.requestAnimationFrame(() => uploadInputRef.current?.focus());
  }, [focusTarget, variants]);

  function updateJob(jobId: string, updates: Partial<UploadJob>, expectedProductId = productId) {
    if (currentProductIdRef.current !== expectedProductId) return;
    setUploads((current) => current.map((job) => (job.id === jobId ? { ...job, ...updates } : job)));
  }

  async function uploadIntentFile(
    job: UploadJob,
    intent: UploadIntent,
    signal: AbortSignal,
    expectedProductId = productId,
  ) {
    if (currentProductIdRef.current !== expectedProductId) return null;
    updateJob(job.id, {
      phase: "uploading",
      progress: 45,
      message: "Uploading securely…",
      intentId: intent.intentId,
    }, expectedProductId);
    const direct = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": job.file.type },
      body: job.file,
      signal,
    });
    if (currentProductIdRef.current !== expectedProductId) return null;
    if (!direct.ok) throw new Error("The file could not be uploaded. Try again.");

    updateJob(job.id, { phase: "verifying", progress: 85, message: "Verifying and preparing…" }, expectedProductId);
    const completeResponse = await fetch("/api/products/digital-assets/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId: intent.intentId }),
      signal,
    });
    const completePayload = await responseJson(completeResponse);
    if (currentProductIdRef.current !== expectedProductId) return null;
    if (!completeResponse.ok) {
      return {
        ok: false as const,
        assetId: intent.assetId,
        message: parseError(completePayload, "The uploaded file could not be verified."),
      };
    }
    return { ok: true as const, assetId: intent.assetId };
  }

  async function beginUpload(job: UploadJob, signal: AbortSignal, expectedProductId = productId) {
    updateJob(job.id, { phase: "preparing", progress: 10, message: "Preparing secure upload…" }, expectedProductId);
    const response = await fetch("/api/products/digital-assets/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        productVariantId: scope ? scope.productVariantId : uploadScope === "all" ? null : uploadScope,
        label: job.label,
        fileName: job.file.name,
        mimeType: job.file.type,
        sizeBytes: job.file.size,
      }),
      signal,
    });
    const payload = await responseJson(response);
    if (currentProductIdRef.current !== expectedProductId) return null;
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(parseError(payload, "Unable to prepare upload."));
    }
    return uploadIntentFile(job, payload as UploadIntent, signal, expectedProductId);
  }

  async function uploadSelectedFiles(files: File[]) {
    const expectedProductId = productId;
    setError(null);
    const availableSlots = DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct - assets.length - uploads.filter((job) => job.phase !== "failed").length;
    if (files.length > availableSlots) {
      showError(`You can attach up to ${DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct} customer files to a product.`);
      return;
    }
    const invalid = files.map((file) => ({ file, error: validateFile(file) })).find((entry) => entry.error);
    if (invalid?.error) {
      showError(`${invalid.file.name}: ${invalid.error}`);
      return;
    }

    const jobs = files.map<UploadJob>((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
      file,
      label: fileLabel(file.name),
      progress: 5,
      phase: "preparing",
      message: "Queued…",
      intentId: null,
    }));
    setUploads((current) => [...current, ...jobs]);

    const results = await Promise.all(
      jobs.map(async (job) => {
        const controller = beginOperation();
        try {
          return await beginUpload(job, controller.signal, expectedProductId);
        } catch (uploadError) {
          if (isAbortError(uploadError, controller.signal)) return null;
          return {
            ok: false as const,
            assetId: null,
            message: uploadError instanceof Error ? uploadError.message : "Unable to upload file.",
          };
        } finally {
          finishOperation(controller);
        }
      }),
    );
    if (currentProductIdRef.current !== expectedProductId) return;

    let refreshed: DigitalProductAsset[] = [];
    const refreshController = beginOperation();
    try {
      refreshed = (await loadAssets(refreshController.signal))?.assets ?? [];
      if (currentProductIdRef.current !== expectedProductId) return;
      await onCatalogChange?.(refreshController.signal);
    } catch (loadError) {
      if (isAbortError(loadError, refreshController.signal)) return;
      showError(loadError instanceof Error ? loadError.message : "Unable to refresh customer files.");
    } finally {
      finishOperation(refreshController);
    }
    const completedAssetIds = new Set(refreshed.map((asset) => asset.id));
    let successCount = 0;
    results.forEach((result, index) => {
      const job = jobs[index];
      if (!job || !result) return;
      const committedDespiteResponse = result.assetId ? completedAssetIds.has(result.assetId) : false;
      if (result.ok || committedDespiteResponse) {
        successCount += 1;
        setUploads((current) => current.filter((candidate) => candidate.id !== job.id));
        if (!result.ok && committedDespiteResponse) notify.info(result.message);
      } else {
        updateJob(job.id, { phase: "failed", progress: 100, message: result.message });
      }
    });
    if (successCount > 0) {
      notify.success(
        successCount === 1 ? "Customer file is ready." : `${successCount} customer files are ready.`,
      );
    }
  }

  async function retryUpload(job: UploadJob) {
    const expectedProductId = productId;
    const controller = beginOperation();
    setError(null);
    try {
      let result;
      if (job.intentId) {
        updateJob(job.id, { phase: "preparing", progress: 10, message: "Preparing retry…" });
        const response = await fetch("/api/products/digital-assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", intentId: job.intentId }),
          signal: controller.signal,
        });
        const payload = await responseJson(response);
        if (!response.ok || !payload || typeof payload !== "object") {
          throw new Error(parseError(payload, "Unable to retry upload."));
        }
        if (currentProductIdRef.current !== expectedProductId) return;
        result = await uploadIntentFile(job, payload as UploadIntent, controller.signal, expectedProductId);
      } else {
        result = await beginUpload(job, controller.signal, expectedProductId);
      }
      if (!result || currentProductIdRef.current !== expectedProductId) return;
      const refreshed = (await loadAssets(controller.signal))?.assets ?? [];
      if (currentProductIdRef.current !== expectedProductId) return;
      if (result.ok || (result.assetId && refreshed.some((asset) => asset.id === result.assetId))) {
        setUploads((current) => current.filter((candidate) => candidate.id !== job.id));
        notify.success("Customer file is ready.");
        // Rights are affirmed against the file that was actually uploaded,
        // while the merchant still has it in mind.
        setPendingConfirmation({ type: "rights", fileName: job.file.name });
        await onCatalogChange?.(controller.signal);
      } else {
        updateJob(job.id, { phase: "failed", progress: 100, message: result.message });
      }
    } catch (retryError) {
      if (isAbortError(retryError, controller.signal)) return;
      updateJob(job.id, {
        phase: "failed",
        progress: 100,
        message: retryError instanceof Error ? retryError.message : "Unable to retry upload.",
      });
    } finally {
      finishOperation(controller);
    }
  }

  async function retryPersistedUpload(intent: PersistedFailedUpload, file: File) {
    const expectedProductId = productId;
    const declarationError = validateFile(file);
    if (declarationError) {
      showError(`${file.name}: ${declarationError}`);
      return;
    }
    if (
      file.name !== intent.expected_filename ||
      file.type !== intent.expected_mime_type ||
      file.size !== intent.expected_byte_size
    ) {
      showError(`Choose the original ${intent.expected_filename} file (${intent.expected_byte_size.toLocaleString()} bytes) to retry securely.`);
      return;
    }

    const controller = beginOperation();
    setBusyFailedIntentIds((current) => new Set(current).add(intent.id));
    setError(null);
    try {
      const retryResponse = await fetch("/api/products/digital-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", intentId: intent.id }),
        signal: controller.signal,
      });
      const retryPayload = await responseJson(retryResponse);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!retryResponse.ok || !retryPayload || typeof retryPayload !== "object") {
        throw new Error(parseError(retryPayload, "Unable to retry upload."));
      }
      const uploadIntent = retryPayload as UploadIntent;
      const uploadResponse = await fetch(uploadIntent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!uploadResponse.ok) throw new Error("The file could not be uploaded. Try again.");

      const completeResponse = await fetch("/api/products/digital-assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: intent.id }),
        signal: controller.signal,
      });
      const completePayload = await responseJson(completeResponse);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!completeResponse.ok) {
        throw new Error(parseError(completePayload, "The uploaded file could not be verified."));
      }
      await loadAssets(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      await onCatalogChange?.(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      notify.success("Customer file is ready.");
    } catch (retryError) {
      if (isAbortError(retryError, controller.signal)) return;
      if (currentProductIdRef.current !== expectedProductId) return;
      showError(retryError instanceof Error ? retryError.message : "Unable to retry upload.");
    } finally {
      finishOperation(controller);
      if (currentProductIdRef.current === expectedProductId) {
        setBusyFailedIntentIds((current) => {
          const next = new Set(current);
          next.delete(intent.id);
          return next;
        });
      }
    }
  }

  async function updateAsset(assetId: string, updates: { label?: string; productVariantId?: string | null }) {
    const expectedProductId = productId;
    const controller = beginOperation();
    setBusyAssetIds((current) => new Set(current).add(assetId));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", assetId, ...updates }),
        signal: controller.signal,
      });
      const payload = await responseJson(response);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!response.ok) throw new Error(parseError(payload, "Unable to update this file."));
      await loadAssets(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      await onCatalogChange?.(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      notify.success(updates.label ? "File label updated." : "File availability updated.");
    } catch (updateError) {
      if (isAbortError(updateError, controller.signal)) return;
      if (currentProductIdRef.current !== expectedProductId) return;
      showError(updateError instanceof Error ? updateError.message : "Unable to update this file.");
    } finally {
      finishOperation(controller);
      if (currentProductIdRef.current === expectedProductId) {
        setBusyAssetIds((current) => {
          const next = new Set(current);
          next.delete(assetId);
          return next;
        });
      }
    }
  }

  async function moveAsset(assetId: string, direction: -1 | 1) {
    const expectedProductId = productId;
    const currentIndex = assets.findIndex((asset) => asset.id === assetId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= assets.length) return;
    const previous = assets;
    const next = [...assets];
    const [moved] = next.splice(currentIndex, 1);
    if (!moved) return;
    const controller = beginOperation();
    next.splice(targetIndex, 0, moved);
    setAssets(next.map((asset, index) => ({ ...asset, sort_order: index })));
    setBusyAssetIds((current) => new Set(current).add(assetId));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, assetIds: next.map((asset) => asset.id) }),
        signal: controller.signal,
      });
      const payload = await responseJson(response);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!response.ok) throw new Error(parseError(payload, "Files could not be reordered."));
      notify.success("File order updated.");
    } catch (reorderError) {
      if (isAbortError(reorderError, controller.signal)) return;
      if (currentProductIdRef.current !== expectedProductId) return;
      setAssets(previous);
      showError(
        reorderError instanceof Error
          ? `Files could not be reordered. ${reorderError.message}`
          : "Files could not be reordered. Try again.",
      );
    } finally {
      finishOperation(controller);
      if (currentProductIdRef.current === expectedProductId) {
        setBusyAssetIds((current) => {
          const nextBusy = new Set(current);
          nextBusy.delete(assetId);
          return nextBusy;
        });
      }
    }
  }

  async function replaceAsset(asset: DigitalProductAsset, file: File) {
    const expectedProductId = productId;
    const validationError = validateFile(file);
    if (validationError) {
      showError(`${file.name}: ${validationError}`);
      return;
    }
    const controller = beginOperation();
    setBusyAssetIds((current) => new Set(current).add(asset.id));
    setError(null);
    try {
      const intentResponse = await fetch(`/api/products/digital-assets/${asset.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
        signal: controller.signal,
      });
      const intentPayload = await responseJson(intentResponse);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!intentResponse.ok || !intentPayload || typeof intentPayload !== "object") {
        throw new Error(parseError(intentPayload, "Unable to prepare replacement."));
      }
      const intent = intentPayload as UploadIntent;
      const direct = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!direct.ok) throw new Error("The replacement could not be uploaded.");
      const completeResponse = await fetch("/api/products/digital-assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: intent.intentId }),
        signal: controller.signal,
      });
      const completePayload = await responseJson(completeResponse);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!completeResponse.ok) {
        const refreshed = (await loadAssets(controller.signal))?.assets ?? [];
        if (currentProductIdRef.current !== expectedProductId) return;
        const refreshedVersions = refreshed.find((item) => item.id === asset.id)?.digital_product_asset_versions ?? [];
        const currentVersion = [...refreshedVersions].sort((left, right) => right.version_number - left.version_number)[0];
        if (!currentVersion || currentVersion.customer_filename !== file.name) {
          throw new Error(parseError(completePayload, "Unable to finish replacement."));
        }
        notify.info(parseError(completePayload, "Add a storefront preview before publishing."));
      } else {
        await loadAssets(controller.signal);
        if (currentProductIdRef.current !== expectedProductId) return;
      }
      await onCatalogChange?.(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      notify.success("Customer file replaced. Existing purchases still use their original version.");
    } catch (replaceError) {
      if (isAbortError(replaceError, controller.signal)) return;
      if (currentProductIdRef.current !== expectedProductId) return;
      showError(replaceError instanceof Error ? replaceError.message : "Unable to replace this file.");
    } finally {
      finishOperation(controller);
      if (currentProductIdRef.current === expectedProductId) {
        setBusyAssetIds((current) => {
          const next = new Set(current);
          next.delete(asset.id);
          return next;
        });
      }
    }
  }

  async function removeAsset(asset: DigitalProductAsset) {
    const expectedProductId = productId;
    const controller = beginOperation();
    setBusyAssetIds((current) => new Set(current).add(asset.id));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
        signal: controller.signal,
      });
      const payload = await responseJson(response);
      if (currentProductIdRef.current !== expectedProductId) return;
      if (!response.ok) throw new Error(parseError(payload, "Unable to remove this file."));
      setAssets((current) => current.filter((candidate) => candidate.id !== asset.id));
      await onCatalogChange?.(controller.signal);
      if (currentProductIdRef.current !== expectedProductId) return;
      notify.success("Customer file removed. Existing purchases are preserved.");
    } catch (removeError) {
      if (isAbortError(removeError, controller.signal)) return;
      if (currentProductIdRef.current !== expectedProductId) return;
      showError(removeError instanceof Error ? removeError.message : "Unable to remove this file.");
    } finally {
      finishOperation(controller);
      if (currentProductIdRef.current === expectedProductId) {
        setBusyAssetIds((current) => {
          const next = new Set(current);
          next.delete(asset.id);
          return next;
        });
      }
    }
  }

  const activeUploadCount = uploads.filter((job) => job.phase !== "failed").length;
  useEffect(() => {
    onAssetsChange?.(assets);
  }, [assets, onAssetsChange]);

  const scopedAssets = scope
    ? assets.filter((asset) => (asset.product_variant_id ?? null) === scope.productVariantId)
    : assets;

  // Watermarked buyer previews are only generated from JPEG or PNG originals.
  // Anything else needs a storefront image to stand in, or the product cannot
  // be published.
  const needsStandInPreview = scopedAssets.some((asset) =>
    asset.digital_product_asset_versions.some(
      (version) => version.retired_at === null && version.mime_type !== "image/jpeg" && version.mime_type !== "image/png",
    ),
  );
  const missingProductImage = needsStandInPreview && productImageUrls.length === 0;

  const uploadDisabled = assets.length + activeUploadCount >= DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct;

  return (
    <Lister
      title="Customer downloads"
      description={
        scope
          ? "Originals stay private. Buyers who purchase this option receive these files."
          : "Originals stay private. Buyers receive only the ready files that apply to their selected variant."
      }
      meta={`${assets.length + activeUploadCount} of ${DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct} files · JPG, PNG, PDF, or ZIP · 250 MB each`}
      addControl={
        <div className="flex shrink-0 items-center gap-2">
          {!scope && variants.length > 0 ? (
            <label className="space-y-1 text-xs font-medium">
              <span className="sr-only">Applies to</span>
              <Select value={uploadScope} onChange={(event) => setUploadScope(event.target.value)} aria-label="Applies to">
                <option value="all">All variants</option>
                {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
              </Select>
            </label>
          ) : null}
          <HintTooltip hint="Add files">
          <label
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${uploadDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              disabled={uploadDisabled}
              accept={Object.keys(DIGITAL_PRODUCT_CONFIG.acceptedFiles).join(",")}
              className="sr-only"
              aria-label="Add customer download files"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length > 0) void uploadSelectedFiles(files);
                event.target.value = "";
              }}
            />
          </label>
          </HintTooltip>
        </div>
      }
    >
      {error ? (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 outline-none focus:ring-2 focus:ring-red-500"
        >
          {error}
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <div className="space-y-2" aria-label="Current uploads">
          {uploads.map((job) => (
            <div
              key={job.id}
              role="status"
              aria-label={`Upload progress for ${job.file.name}`}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.file.name}</p>
                  <p className={job.phase === "failed" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{job.message}</p>
                </div>
                {job.phase === "failed" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void retryUpload(job)}>
                    Retry upload
                  </Button>
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground">{job.progress}%</span>
                )}
              </div>
              <progress className="mt-2 h-1.5 w-full accent-primary" max={100} value={job.progress} aria-label={`${job.progress}% uploaded`} />
            </div>
          ))}
        </div>
      ) : null}

      {failedUploads.length > 0 ? (
        <div className="space-y-2" aria-label="Uploads needing attention">
          {failedUploads.map((intent) => {
            const busy = busyFailedIntentIds.has(intent.id);
            return (
              <div
                key={intent.id}
                role="status"
                aria-label={`Failed upload for ${intent.expected_filename}`}
                className="rounded-lg border border-amber-300 bg-amber-50/60 p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{intent.label}</p>
                    <p className="text-xs text-muted-foreground">{intent.expected_filename} · version {intent.version_number}</p>
                    <p className="mt-1 text-xs text-amber-900">{intent.last_safe_error}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Reselect the original file to retry securely. This retries the private customer file upload, not buyer preview processing.</p>
                  </div>
                  <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                    {busy ? "Retrying…" : "Reselect and retry"}
                    <input
                      type="file"
                      disabled={busy}
                      accept={Object.keys(DIGITAL_PRODUCT_CONFIG.acceptedFiles).join(",")}
                      className="sr-only"
                      aria-label={`Select ${intent.expected_filename} to retry`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void retryPersistedUpload(intent, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading customer files…</p> : null}
      {!rightsAffirmed && scopedAssets.length > 0 ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            <span className="font-medium">Confirm you can sell these files.</span>{" "}
            Myrivo&apos;s terms require you to hold the rights to distribute and sell everything you upload.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void affirmRights()}>
            I hold the rights
          </Button>
        </div>
      ) : null}

      {missingProductImage ? (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Add a product image before publishing</p>
          <p className="mt-1 text-xs">
            Buyer previews are watermarked from the original file, which only works for JPG and PNG. This file type needs a
            storefront image to show buyers instead — add one in the product&apos;s images, then choose it as the buyer preview.
          </p>
        </div>
      ) : null}

      {!loading && scopedAssets.length === 0 && uploads.length === 0 && failedUploads.length === 0 ? (
        <ListerEmpty>No files yet. Add at least one ready file before publishing this digital product.</ListerEmpty>
      ) : null}

      {scopedAssets.length > 0 ? (
        <ListerRows label="Customer download files">
          {scopedAssets.map((asset, index) => (
            <DigitalProductFileRow
              key={asset.id}
              asset={asset}
              variants={variants}
              scopeLocked={Boolean(scope)}
              index={index}
              count={scopedAssets.length}
              busy={busyAssetIds.has(asset.id)}
              onRename={(label) => updateAsset(asset.id, { label })}
              onAssign={(productVariantId) => updateAsset(asset.id, { productVariantId })}
              onMove={(direction) => moveAsset(asset.id, direction)}
              onReplace={(file, returnFocus) => setPendingConfirmation({ type: "replace", asset, file, returnFocus })}
              onRemove={() => setPendingConfirmation({ type: "remove", asset })}
            />
          ))}
        </ListerRows>
      ) : null}

      {pendingConfirmation?.type === "replace" ? (
        <ConfirmDialog
          open
          title={`Replace ${pendingConfirmation.asset.label}?`}
          description="This creates a new version for future purchases. Existing customers keep the exact version they bought."
          confirmLabel="Replace file"
          onCancel={() => {
            const returnFocus = pendingConfirmation.returnFocus;
            setPendingConfirmation(null);
            queueMicrotask(() => returnFocus?.focus());
          }}
          onConfirm={() => {
            const pending = pendingConfirmation;
            setPendingConfirmation(null);
            void replaceAsset(pending.asset, pending.file).finally(() => {
              queueMicrotask(() => pending.returnFocus?.focus());
            });
          }}
        />
      ) : null}
      {pendingConfirmation?.type === "rights" ? (
        <ConfirmDialog
          open
          title="Confirm you can sell this file"
          description={`Myrivo's terms require you to hold the rights to distribute and sell every file you upload. Confirm that you own "${pendingConfirmation.fileName}" or are authorised by the rights holder to sell it.`}
          confirmLabel="I hold the rights"
          cancelLabel="Not yet"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            setPendingConfirmation(null);
            void affirmRights();
          }}
        />
      ) : null}

      {pendingConfirmation?.type === "remove" ? (
        <ConfirmDialog
          open
          title={`Remove ${pendingConfirmation.asset.label}?`}
          description="The file will stop being included in new purchases. Existing customers keep access to versions they purchased."
          confirmLabel="Remove file"
          confirmVariant="destructive"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            const pending = pendingConfirmation;
            setPendingConfirmation(null);
            void removeAsset(pending.asset);
          }}
        />
      ) : null}
    </Lister>
  );
}
