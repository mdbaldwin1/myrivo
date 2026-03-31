"use client";

import Image from "next/image";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { ensureStorefrontSettingsDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import { prepareImageUploadFile } from "@/lib/uploads/prepare-image-upload-file";
import { cn } from "@/lib/utils";

type StoreExperienceImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

type StorefrontStudioEditableWelcomePopupImageProps = {
  imageUrl: string | null;
  className?: string;
};

export function StorefrontStudioEditableWelcomePopupImage({
  imageUrl,
  className
}: StorefrontStudioEditableWelcomePopupImageProps) {
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
    formData.append("folder", "welcome-popup");
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

      document.setSettingsDraft((current) => ({
        ...ensureStorefrontSettingsDraft(current),
        welcome_popup_image_path: payload.imageUrl
      }));
      URL.revokeObjectURL(previewUrl);
      setOptimisticImageUrl(null);
      notify.success("Welcome popup image uploaded. Changes save automatically.");
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setOptimisticImageUrl(null);
      notify.error(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div data-studio-ignore-navigation="true" className={cn("group/welcome-popup-image relative h-full min-h-[14rem]", className)}>
      {resolvedImageUrl ? (
        <Image src={resolvedImageUrl} alt="" fill unoptimized className="object-cover" />
      ) : (
        <div className="flex h-full min-h-[14rem] items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            <span>Add popup image</span>
          </div>
        </div>
      )}

      {document ? (
        <>
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover/welcome-popup-image:opacity-100 sm:group-focus-within/welcome-popup-image:opacity-100">
            {resolvedImageUrl ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full border border-border/70 bg-white/95 shadow-sm"
                aria-label="Remove welcome popup image"
                disabled={isUploading}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (optimisticImageUrl) {
                    URL.revokeObjectURL(optimisticImageUrl);
                    setOptimisticImageUrl(null);
                  }
                  document.setSettingsDraft((current) => ({
                    ...ensureStorefrontSettingsDraft(current),
                    welcome_popup_image_path: null
                  }));
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
              aria-label={resolvedImageUrl ? "Replace welcome popup image" : "Upload welcome popup image"}
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
