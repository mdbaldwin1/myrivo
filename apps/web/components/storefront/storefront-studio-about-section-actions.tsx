"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import { moveAboutSection, removeAboutSection, updateAboutSection } from "@/lib/storefront/studio-structure";
import { prepareImageUploadFile } from "@/lib/uploads/prepare-image-upload-file";

type StorefrontStudioAboutSectionActionsProps = {
  sectionId: string;
  layout: "image_left" | "image_right" | "full";
  imageUrl: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

type ImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

export function StorefrontStudioAboutSectionActions({
  sectionId,
  layout,
  imageUrl,
  canMoveUp,
  canMoveDown
}: StorefrontStudioAboutSectionActionsProps) {
  const document = useOptionalStorefrontStudioDocument();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!document) {
    return null;
  }

  const studioDocument = document;

  async function uploadImage(file: File) {
    setUploading(true);

    try {
      const preparedFile = await prepareImageUploadFile(file);
      const formData = new FormData();
      formData.append("file", preparedFile);
      formData.append("folder", "about");
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/image", studioDocument.storeSlug), {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as ImageUploadResponse;

      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }

      studioDocument.setSectionDraft("aboutPage", (current) =>
        updateAboutSection(current, sectionId, {
          imageUrl: payload.imageUrl ?? "",
          layout: layout === "full" ? "image_right" : layout
        })
      );
      studioDocument.setSelection({ kind: "about-section", id: sectionId });
      notify.success("Section image uploaded. Changes save automatically.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-white/95 p-1 shadow-sm opacity-0 transition group-hover/selection:opacity-100 group-focus-within/selection:opacity-100">
      <Button
        type="button"
        size="sm"
        variant={layout === "image_left" ? "secondary" : "ghost"}
        className="h-7 rounded-full px-2.5 text-[10px] font-semibold"
        aria-label="Set layout to image left"
        title={imageUrl ? "Show image on the left" : "Add an image to use left/right layout"}
        disabled={!imageUrl}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => updateAboutSection(current, sectionId, { layout: "image_left" }));
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        Image left
      </Button>
      <Button
        type="button"
        size="sm"
        variant={layout === "image_right" ? "secondary" : "ghost"}
        className="h-7 rounded-full px-2.5 text-[10px] font-semibold"
        aria-label="Set layout to image right"
        title={imageUrl ? "Show image on the right" : "Add an image to use left/right layout"}
        disabled={!imageUrl}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => updateAboutSection(current, sectionId, { layout: "image_right" }));
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        Image right
      </Button>
      <Button
        type="button"
        size="sm"
        variant={layout === "full" ? "secondary" : "ghost"}
        className="h-7 rounded-full px-2.5 text-[10px] font-semibold"
        aria-label="Set layout to text only"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => updateAboutSection(current, sectionId, { layout: "full" }));
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        Text only
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          void uploadImage(file);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        aria-label={imageUrl ? "Replace section image" : "Add section image"}
        disabled={uploading}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          fileInputRef.current?.click();
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        <ImagePlus className="h-3.5 w-3.5" />
      </Button>
      {imageUrl ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          aria-label="Remove section image"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            studioDocument.setSectionDraft("aboutPage", (current) => updateAboutSection(current, sectionId, { imageUrl: "" }));
            studioDocument.setSelection({ kind: "about-section", id: sectionId });
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        disabled={!canMoveUp}
        aria-label="Move section up"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => moveAboutSection(current, sectionId, "up"));
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        disabled={!canMoveDown}
        aria-label="Move section down"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => moveAboutSection(current, sectionId, "down"));
          studioDocument.setSelection({ kind: "about-section", id: sectionId });
        }}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
        aria-label="Remove section"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          studioDocument.setSectionDraft("aboutPage", (current) => removeAboutSection(current, sectionId));
          studioDocument.clearSelection();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
