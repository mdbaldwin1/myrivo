"use client";

import { ImagePlus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/feedback/toast";
import { RICH_TEXT_IMAGE_ALIGNMENTS } from "@/lib/rich-text-editor";
import { prepareImageUploadFile } from "@/lib/uploads/prepare-image-upload-file";
import { cn } from "@/lib/utils";

export type RichTextEditorImageUploadConfig = {
  enabled?: boolean;
  folder?: string;
  storeSlug?: string;
};

type RichTextEditorImageControlProps = {
  editor: Editor;
  disabled?: boolean;
  buttonClassName?: string;
  upload?: RichTextEditorImageUploadConfig;
};

type ImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

export function RichTextEditorImageControl({
  editor,
  disabled = false,
  buttonClassName,
  upload
}: RichTextEditorImageControlProps) {
  const enabled = upload?.enabled !== false;
  const [open, setOpen] = useState(false);
  const [altText, setAltText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [alignment, setAlignment] = useState<"left" | "right" | "full">("full");
  const [uploading, setUploading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current) {
        return;
      }

      if (event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!enabled) {
    return null;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleInsertImage() {
    if (!selectedFile) {
      notify.error("Choose an image to insert.");
      return;
    }

    setUploading(true);

    try {
      const preparedFile = await prepareImageUploadFile(selectedFile);
      const formData = new FormData();
      formData.set("file", preparedFile);
      formData.set("folder", upload?.folder ?? "rich-text");
      if (upload?.storeSlug) {
        formData.set("storeSlug", upload.storeSlug);
      }

      const response = await fetch("/api/rich-text/images", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => ({}))) as ImageUploadResponse;
      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }

      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src: payload.imageUrl,
            alt: altText.trim() || undefined,
            align: alignment
          }
        })
        .run();

      setAltText("");
      setAlignment("full");
      setSelectedFile(null);
      setOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleInsertImage();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={open ? "secondary" : "ghost"}
            size="icon"
            className={cn(buttonClassName)}
            aria-label="Insert image"
            disabled={disabled || uploading}
            onClick={() => setOpen((current) => !current)}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Insert image</TooltipContent>
      </Tooltip>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-[22rem] rounded-xl border border-border bg-background p-3 shadow-lg"
          onKeyDown={handlePanelKeyDown}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Insert image</p>
              <p className="text-xs text-muted-foreground">Upload an image and place it at the current cursor.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close image panel" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="rich-text-image-upload" className="text-xs font-medium text-muted-foreground">
                Image file
              </label>
              <input
                ref={fileInputRef}
                id="rich-text-image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="block w-full cursor-pointer text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
                onChange={handleFileChange}
              />
              {selectedFile ? <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rich-text-image-alt" className="text-xs font-medium text-muted-foreground">
                Alt text
              </label>
              <Input
                id="rich-text-image-alt"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="Describe the image"
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rich-text-image-alignment" className="text-xs font-medium text-muted-foreground">
                Layout
              </label>
              <select
                id="rich-text-image-alignment"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
                disabled={uploading}
                value={alignment}
                onChange={(event) => setAlignment(event.target.value as "left" | "right" | "full")}
              >
                {RICH_TEXT_IMAGE_ALIGNMENTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void handleInsertImage()} disabled={!selectedFile || uploading}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Insert image"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
