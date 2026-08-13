"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DigitalProductPreview } from "@/components/dashboard/product-manager-domain";
import { notify } from "@/lib/feedback/toast";

type DigitalPreviewManagerProps = {
  productId: string;
  productTitle: string;
  storefrontImages: string[];
  preview: DigitalProductPreview | null | undefined;
  onChange?: (preview: DigitalProductPreview) => void | Promise<void>;
};

const EMPTY_PREVIEW: DigitalProductPreview = {
  status: "missing",
  sourceAssetVersionId: null,
  publicUrl: null,
  isMerchantOverride: false,
  failureReason: null,
};

export function DigitalPreviewManager({
  productId,
  productTitle,
  storefrontImages,
  preview,
  onChange,
}: DigitalPreviewManagerProps) {
  const [current, setCurrent] = useState<DigitalProductPreview>(preview ?? EMPTY_PREVIEW);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const currentProductIdRef = useRef(productId);
  const operationControllersRef = useRef<Set<AbortController>>(new Set());
  currentProductIdRef.current = productId;

  useEffect(() => {
    const operationControllers = operationControllersRef.current;
    for (const controller of operationControllers) controller.abort();
    operationControllers.clear();
    currentProductIdRef.current = productId;
    setCurrent(preview ?? EMPTY_PREVIEW);
    setBusyUrl(null);
    setError(null);
    return () => {
      for (const controller of operationControllers) controller.abort();
      operationControllers.clear();
      if (currentProductIdRef.current === productId) currentProductIdRef.current = "";
    };
  }, [productId, preview]);

  async function setOverride(sourceUrl: string) {
    const operationProductId = productId;
    const controller = new AbortController();
    operationControllersRef.current.add(controller);
    setBusyUrl(sourceUrl);
    setError(null);
    try {
      const response = await fetch("/api/products/digital-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "override", productId, sourceUrl }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as { publicUrl?: string; error?: string } | null;
      if (currentProductIdRef.current !== operationProductId) return;
      if (!response.ok || !payload?.publicUrl) throw new Error(payload?.error ?? "Unable to update the buyer preview.");
      const next: DigitalProductPreview = {
        status: "ready",
        sourceAssetVersionId: null,
        publicUrl: payload.publicUrl,
        isMerchantOverride: true,
        failureReason: null,
      };
      setCurrent(next);
      await onChange?.(next);
      if (currentProductIdRef.current !== operationProductId) return;
      notify.success("Buyer preview updated.");
    } catch (updateError) {
      if (controller.signal.aborted || currentProductIdRef.current !== operationProductId) return;
      setError(updateError instanceof Error ? updateError.message : "Unable to update the buyer preview.");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      operationControllersRef.current.delete(controller);
      if (currentProductIdRef.current === operationProductId) setBusyUrl(null);
    }
  }

  async function retryAutomaticPreview() {
    if (!current.sourceAssetVersionId) return;
    const operationProductId = productId;
    const controller = new AbortController();
    operationControllersRef.current.add(controller);
    setBusyUrl("automatic");
    setError(null);
    try {
      const response = await fetch("/api/products/digital-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "asset", productId, sourceAssetVersionId: current.sourceAssetVersionId }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as { publicUrl?: string | null; error?: string } | null;
      if (currentProductIdRef.current !== operationProductId) return;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to retry the buyer preview.");
      const next: DigitalProductPreview = {
        ...current,
        status: payload?.publicUrl ? "ready" : "processing",
        publicUrl: payload?.publicUrl ?? null,
        isMerchantOverride: false,
        failureReason: null,
      };
      setCurrent(next);
      await onChange?.(next);
      if (currentProductIdRef.current !== operationProductId) return;
      notify.success(payload?.publicUrl ? "Buyer preview is ready." : "Buyer preview processing restarted.");
    } catch (retryError) {
      if (controller.signal.aborted || currentProductIdRef.current !== operationProductId) return;
      setError(retryError instanceof Error ? retryError.message : "Unable to retry the buyer preview.");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      operationControllersRef.current.delete(controller);
      if (currentProductIdRef.current === operationProductId) setBusyUrl(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 outline-none focus:ring-2 focus:ring-red-500">
          {error}
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="storefront-images-title">
        <div>
          <h4 id="storefront-images-title" className="font-medium">Storefront images</h4>
          <p className="text-xs text-muted-foreground">Public product photography and artwork used throughout your storefront.</p>
        </div>
        {storefrontImages.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {storefrontImages.map((imageUrl, index) => (
              <li key={imageUrl} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative aspect-[4/3] bg-muted/20">
                  <Image src={imageUrl} alt={`${productTitle} storefront image ${index + 1}`} fill unoptimized className="object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="text-xs text-muted-foreground">Storefront image {index + 1}</span>
                  <Button type="button" size="sm" variant="outline" disabled={busyUrl !== null} onClick={() => void setOverride(imageUrl)}>
                    {busyUrl === imageUrl ? "Preparing…" : "Use as buyer preview"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Add a storefront image in Edit product.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/15 p-4" aria-labelledby="deliverables-title">
        <h4 id="deliverables-title" className="font-medium">Customer deliverables</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Original files are managed privately in Files. They are never shown or linked from the storefront.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="buyer-preview-title">
        <div className="flex flex-wrap items-center gap-2">
          <h4 id="buyer-preview-title" className="font-medium">Buyer preview</h4>
          <Badge variant="outline">{current.isMerchantOverride ? "Storefront image source" : "Automatic watermark"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">This is the exact public, watermarked preview buyers see. Original deliverables remain private.</p>
        {current.status === "ready" && current.publicUrl ? (
          <div className="relative aspect-[4/3] max-w-xl overflow-hidden rounded-xl border border-border bg-muted/20">
            <Image src={current.publicUrl} alt={`Public preview buyers see for ${productTitle}`} fill unoptimized className="object-contain" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5">
            <p className="text-sm font-medium">
              {current.status === "processing" ? "Public preview is processing" : current.status === "failed" ? "Public preview needs attention" : "No public preview is ready"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a storefront image above or add a ready JPG or PNG in Files.
            </p>
            {current.status === "failed" && current.sourceAssetVersionId ? (
              <Button type="button" size="sm" variant="outline" className="mt-3" disabled={busyUrl !== null} onClick={() => void retryAutomaticPreview()}>
                {busyUrl === "automatic" ? "Retrying…" : "Retry automatic preview"}
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
