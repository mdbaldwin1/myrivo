"use client";

import Image from "next/image";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import { setStorefrontStudioHomeField } from "@/lib/storefront/studio-home-edit";
import type { HeroImageSize } from "@/lib/theme/storefront-theme";
import { prepareImageUploadFile } from "@/lib/uploads/prepare-image-upload-file";
import { cn } from "@/lib/utils";

type StoreExperienceImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

type StorefrontStudioEditableHeroImageProps = {
  imageUrl: string | null;
  alt: string;
  size: HeroImageSize;
  className?: string;
};

export function StorefrontStudioEditableHeroImage({
  imageUrl,
  alt,
  size,
  className
}: StorefrontStudioEditableHeroImageProps) {
  const document = useOptionalStorefrontStudioDocument();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [optimisticImageUrl, setOptimisticImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const resolvedImageUrl = optimisticImageUrl ?? imageUrl;

  useEffect(() => {
    return () => {
      if (optimisticImageUrl) {
        URL.revokeObjectURL(optimisticImageUrl);
      }
    };
  }, [optimisticImageUrl]);

  async function uploadImage(file: File) {
    if (!document) {
      return;
    }

    const preparedFile = await prepareImageUploadFile(file);
    const formData = new FormData();
    formData.append("file", preparedFile);
    formData.append("folder", "home");
    const previewUrl = URL.createObjectURL(preparedFile);
    setOptimisticImageUrl(previewUrl);
    setIsUploading(true);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/image", document.storeSlug), {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as StoreExperienceImageUploadResponse;

      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }

      document.setSectionDraft("home", (current) => setStorefrontStudioHomeField(current, "hero.imageUrl", payload.imageUrl ?? ""));
      URL.revokeObjectURL(previewUrl);
      setOptimisticImageUrl(null);
      notify.success("Hero image uploaded. Changes save automatically.");
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setOptimisticImageUrl(null);
      notify.error(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  const imageClassName =
    size === "small"
      ? "max-h-32 sm:max-w-[320px]"
      : size === "large"
        ? "max-h-72 sm:max-w-[520px]"
        : "max-h-52 sm:max-w-[420px]";
  const placeholderClassName =
    size === "small"
      ? "h-28 w-[min(82vw,320px)]"
      : size === "large"
      ? "h-52 w-[min(82vw,520px)]"
      : "h-40 w-[min(82vw,420px)]";

  return (
    <div data-studio-ignore-navigation="true" className={cn("group/hero-image relative max-w-fit", className)}>
      {resolvedImageUrl ? (
        <Image
          src={resolvedImageUrl}
          alt={alt}
          width={960}
          height={640}
          loading="eager"
          unoptimized
          className={cn("h-auto w-auto max-w-[82vw] rounded-2xl object-cover shadow-sm", imageClassName)}
        />
      ) : (
        <div className={cn("flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 text-sm text-muted-foreground opacity-0 transition group-hover/hero:opacity-100 group-focus-within/hero:opacity-100", placeholderClassName)}>
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            <span>Add hero image</span>
          </div>
        </div>
      )}

      {document ? (
        <>
          <div className="absolute right-2 top-2 z-20 flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover/hero-image:opacity-100 sm:group-focus-within/hero-image:opacity-100">
            {resolvedImageUrl ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full border border-border/70 bg-white/95 shadow-sm"
                aria-label="Remove hero image"
                disabled={isUploading}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (optimisticImageUrl) {
                    URL.revokeObjectURL(optimisticImageUrl);
                    setOptimisticImageUrl(null);
                  }
                  document.setSectionDraft("home", (current) => setStorefrontStudioHomeField(current, "hero.imageUrl", ""));
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full border border-border/70 bg-white/95 shadow-sm"
              aria-label={resolvedImageUrl ? "Replace hero image" : "Upload hero image"}
              disabled={isUploading}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              {resolvedImageUrl ? <Pencil className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) {
                void uploadImage(file);
              }
              event.target.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}
