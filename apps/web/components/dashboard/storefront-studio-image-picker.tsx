"use client";

import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

type StorefrontStudioImagePickerProps = {
  imageUrl: string;
  disabled?: boolean;
  uploading?: boolean;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
};

export function StorefrontStudioImagePicker({
  imageUrl,
  disabled = false,
  uploading = false,
  onSelectFile,
  onRemove
}: StorefrontStudioImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canInteract = !disabled && !uploading;

  return (
    <div className="space-y-2">
      <div className="relative w-fit">
        <div
          role="button"
          tabIndex={canInteract ? 0 : -1}
          aria-label={imageUrl ? "Replace image" : "Upload image"}
          onClick={() => {
            if (canInteract) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (!canInteract) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`group relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-muted/15 transition-transform ${canInteract ? "cursor-pointer hover:scale-[1.02]" : "cursor-not-allowed opacity-70"} ${!imageUrl ? "border-dashed bg-muted/10 text-muted-foreground hover:border-primary/45 hover:bg-muted/25 hover:text-foreground" : ""}`}
        >
          {imageUrl ? <Image src={imageUrl} alt="Selected preview" fill unoptimized className="object-cover" /> : null}
          {imageUrl ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </div>
          )}
          {uploading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
              Uploading...
            </div>
          ) : null}
        </div>
        {imageUrl ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute right-1 top-1 z-10 h-6 w-6 rounded-full p-0"
            disabled={!canInteract}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{imageUrl ? "Click image to replace." : "Click to upload an image."}</p>
      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or SVG up to 5MB.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        disabled={!canInteract}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelectFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
