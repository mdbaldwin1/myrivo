"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DigitalProductFileRow } from "@/components/dashboard/digital-product-file-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
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
  | { type: "replace"; asset: DigitalProductAsset; file: File }
  | { type: "remove"; asset: DigitalProductAsset }
  | null;

type DigitalProductFilesProps = {
  productId: string;
  variants?: DigitalProductFileVariant[];
  focusTarget?: string | null;
  onCatalogChange?: () => void | Promise<void>;
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

function fileLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Customer file";
}

function validateFile(file: File) {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}` as keyof typeof DIGITAL_PRODUCT_CONFIG.acceptedFiles;
  if (DIGITAL_PRODUCT_CONFIG.acceptedFiles[extension] !== file.type) {
    return "Unsupported file type. Use JPG, PNG, PDF, or ZIP.";
  }
  if (file.size <= 0 || file.size > DIGITAL_PRODUCT_CONFIG.maxFileBytes) {
    return "File must be between 1 byte and 250 MB.";
  }
  return null;
}

function sortAssets(assets: DigitalProductAsset[]) {
  return [...assets].sort((left, right) => left.sort_order - right.sort_order);
}

export function DigitalProductFiles({ productId, variants = [], focusTarget, onCatalogChange }: DigitalProductFilesProps) {
  const [assets, setAssets] = useState<DigitalProductAsset[]>([]);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAssetIds, setBusyAssetIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [uploadScope, setUploadScope] = useState<string>("all");
  const errorRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    if (variants.some((variant) => variant.id === focusTarget)) setUploadScope(focusTarget);
    window.requestAnimationFrame(() => uploadInputRef.current?.focus());
  }, [focusTarget, variants]);

  const showError = useCallback((message: string) => {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  const loadAssets = useCallback(async () => {
    const response = await fetch(`/api/products/digital-assets?productId=${encodeURIComponent(productId)}`);
    const payload = await responseJson(response);
    if (!response.ok) {
      throw new Error(parseError(payload, "Unable to load customer files."));
    }
    const next = sortAssets(
      payload && typeof payload === "object" && Array.isArray((payload as { assets?: unknown }).assets)
        ? ((payload as { assets: DigitalProductAsset[] }).assets ?? [])
        : [],
    );
    setAssets(next);
    return next;
  }, [productId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadAssets()
      .catch((loadError) => {
        if (active) showError(loadError instanceof Error ? loadError.message : "Unable to load customer files.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAssets, showError]);

  function updateJob(jobId: string, updates: Partial<UploadJob>) {
    setUploads((current) => current.map((job) => (job.id === jobId ? { ...job, ...updates } : job)));
  }

  async function uploadIntentFile(job: UploadJob, intent: UploadIntent) {
    updateJob(job.id, {
      phase: "uploading",
      progress: 45,
      message: "Uploading securely…",
      intentId: intent.intentId,
    });
    const direct = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": job.file.type },
      body: job.file,
    });
    if (!direct.ok) throw new Error("The file could not be uploaded. Try again.");

    updateJob(job.id, { phase: "verifying", progress: 85, message: "Verifying and preparing…" });
    const completeResponse = await fetch("/api/products/digital-assets/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId: intent.intentId }),
    });
    const completePayload = await responseJson(completeResponse);
    if (!completeResponse.ok) {
      return {
        ok: false as const,
        assetId: intent.assetId,
        message: parseError(completePayload, "The uploaded file could not be verified."),
      };
    }
    return { ok: true as const, assetId: intent.assetId };
  }

  async function beginUpload(job: UploadJob) {
    updateJob(job.id, { phase: "preparing", progress: 10, message: "Preparing secure upload…" });
    const response = await fetch("/api/products/digital-assets/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        productVariantId: uploadScope === "all" ? null : uploadScope,
        label: job.label,
        fileName: job.file.name,
        mimeType: job.file.type,
        sizeBytes: job.file.size,
      }),
    });
    const payload = await responseJson(response);
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(parseError(payload, "Unable to prepare upload."));
    }
    return uploadIntentFile(job, payload as UploadIntent);
  }

  async function uploadSelectedFiles(files: File[]) {
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
        try {
          return await beginUpload(job);
        } catch (uploadError) {
          return {
            ok: false as const,
            assetId: null,
            message: uploadError instanceof Error ? uploadError.message : "Unable to upload file.",
          };
        }
      }),
    );

    let refreshed: DigitalProductAsset[] = [];
    try {
      refreshed = await loadAssets();
      await onCatalogChange?.();
    } catch (loadError) {
      showError(loadError instanceof Error ? loadError.message : "Unable to refresh customer files.");
    }
    const completedAssetIds = new Set(refreshed.map((asset) => asset.id));
    let successCount = 0;
    results.forEach((result, index) => {
      const job = jobs[index];
      if (!job) return;
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
    setError(null);
    try {
      let result;
      if (job.intentId) {
        updateJob(job.id, { phase: "preparing", progress: 10, message: "Preparing retry…" });
        const response = await fetch("/api/products/digital-assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", intentId: job.intentId }),
        });
        const payload = await responseJson(response);
        if (!response.ok || !payload || typeof payload !== "object") {
          throw new Error(parseError(payload, "Unable to retry upload."));
        }
        result = await uploadIntentFile(job, payload as UploadIntent);
      } else {
        result = await beginUpload(job);
      }
      const refreshed = await loadAssets();
      if (result.ok || (result.assetId && refreshed.some((asset) => asset.id === result.assetId))) {
        setUploads((current) => current.filter((candidate) => candidate.id !== job.id));
        notify.success("Customer file is ready.");
        await onCatalogChange?.();
      } else {
        updateJob(job.id, { phase: "failed", progress: 100, message: result.message });
      }
    } catch (retryError) {
      updateJob(job.id, {
        phase: "failed",
        progress: 100,
        message: retryError instanceof Error ? retryError.message : "Unable to retry upload.",
      });
    }
  }

  async function updateAsset(assetId: string, updates: { label?: string; productVariantId?: string | null }) {
    setBusyAssetIds((current) => new Set(current).add(assetId));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", assetId, ...updates }),
      });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(parseError(payload, "Unable to update this file."));
      await loadAssets();
      await onCatalogChange?.();
      notify.success(updates.label ? "File label updated." : "File availability updated.");
    } catch (updateError) {
      showError(updateError instanceof Error ? updateError.message : "Unable to update this file.");
    } finally {
      setBusyAssetIds((current) => {
        const next = new Set(current);
        next.delete(assetId);
        return next;
      });
    }
  }

  async function moveAsset(assetId: string, direction: -1 | 1) {
    const currentIndex = assets.findIndex((asset) => asset.id === assetId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= assets.length) return;
    const previous = assets;
    const next = [...assets];
    const [moved] = next.splice(currentIndex, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setAssets(next.map((asset, index) => ({ ...asset, sort_order: index })));
    setBusyAssetIds((current) => new Set(current).add(assetId));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, assetIds: next.map((asset) => asset.id) }),
      });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(parseError(payload, "Files could not be reordered."));
      notify.success("File order updated.");
    } catch (reorderError) {
      setAssets(previous);
      showError(
        reorderError instanceof Error
          ? `Files could not be reordered. ${reorderError.message}`
          : "Files could not be reordered. Try again.",
      );
    } finally {
      setBusyAssetIds((current) => {
        const nextBusy = new Set(current);
        nextBusy.delete(assetId);
        return nextBusy;
      });
    }
  }

  async function replaceAsset(asset: DigitalProductAsset, file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      showError(`${file.name}: ${validationError}`);
      return;
    }
    setBusyAssetIds((current) => new Set(current).add(asset.id));
    setError(null);
    try {
      const intentResponse = await fetch(`/api/products/digital-assets/${asset.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const intentPayload = await responseJson(intentResponse);
      if (!intentResponse.ok || !intentPayload || typeof intentPayload !== "object") {
        throw new Error(parseError(intentPayload, "Unable to prepare replacement."));
      }
      const intent = intentPayload as UploadIntent;
      const direct = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!direct.ok) throw new Error("The replacement could not be uploaded.");
      const completeResponse = await fetch("/api/products/digital-assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: intent.intentId }),
      });
      const completePayload = await responseJson(completeResponse);
      if (!completeResponse.ok) {
        const refreshed = await loadAssets();
        const refreshedVersions = refreshed.find((item) => item.id === asset.id)?.digital_product_asset_versions ?? [];
        const currentVersion = [...refreshedVersions].sort((left, right) => right.version_number - left.version_number)[0];
        if (!currentVersion || currentVersion.customer_filename !== file.name) {
          throw new Error(parseError(completePayload, "Unable to finish replacement."));
        }
        notify.info(parseError(completePayload, "Add a storefront preview before publishing."));
      } else {
        await loadAssets();
      }
      await onCatalogChange?.();
      notify.success("Customer file replaced. Existing purchases still use their original version.");
    } catch (replaceError) {
      showError(replaceError instanceof Error ? replaceError.message : "Unable to replace this file.");
    } finally {
      setBusyAssetIds((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
    }
  }

  async function removeAsset(asset: DigitalProductAsset) {
    setBusyAssetIds((current) => new Set(current).add(asset.id));
    setError(null);
    try {
      const response = await fetch("/api/products/digital-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(parseError(payload, "Unable to remove this file."));
      setAssets((current) => current.filter((candidate) => candidate.id !== asset.id));
      await onCatalogChange?.();
      notify.success("Customer file removed. Existing purchases are preserved.");
    } catch (removeError) {
      showError(removeError instanceof Error ? removeError.message : "Unable to remove this file.");
    } finally {
      setBusyAssetIds((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
    }
  }

  const activeUploadCount = uploads.filter((job) => job.phase !== "failed").length;
  const uploadDisabled = assets.length + activeUploadCount >= DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">Customer download files</h4>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Originals stay private. Buyers receive only the ready files that apply to their selected variant.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {variants.length > 0 ? (
            <label className="space-y-1 text-xs font-medium">
              Applies to
              <Select value={uploadScope} onChange={(event) => setUploadScope(event.target.value)}>
                <option value="all">All variants</option>
                {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
              </Select>
            </label>
          ) : null}
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            Add files
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {assets.length + activeUploadCount} of {DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct} files · JPG, PNG, PDF, or ZIP · 250 MB each
      </p>

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

      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading customer files…</p> : null}
      {!loading && assets.length === 0 && uploads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">No customer files yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add at least one ready file before publishing this digital product.</p>
        </div>
      ) : null}

      {assets.length > 0 ? (
        <ul aria-label="Customer download files" className="space-y-3">
          {assets.map((asset, index) => (
            <DigitalProductFileRow
              key={asset.id}
              asset={asset}
              variants={variants}
              index={index}
              count={assets.length}
              busy={busyAssetIds.has(asset.id)}
              onRename={(label) => updateAsset(asset.id, { label })}
              onAssign={(productVariantId) => updateAsset(asset.id, { productVariantId })}
              onMove={(direction) => moveAsset(asset.id, direction)}
              onReplace={(file) => setPendingConfirmation({ type: "replace", asset, file })}
              onRemove={() => setPendingConfirmation({ type: "remove", asset })}
            />
          ))}
        </ul>
      ) : null}

      {pendingConfirmation?.type === "replace" ? (
        <ConfirmDialog
          open
          title={`Replace ${pendingConfirmation.asset.label}?`}
          description="This creates a new version for future purchases. Existing customers keep the exact version they bought."
          confirmLabel="Replace file"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            const pending = pendingConfirmation;
            setPendingConfirmation(null);
            void replaceAsset(pending.asset, pending.file);
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
    </div>
  );
}
