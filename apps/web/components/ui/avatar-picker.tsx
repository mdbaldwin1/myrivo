"use client";

import Image from "next/image";
import { useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AvatarPickerProps = {
  avatarPath: string | null;
  fallbackLabel: string;
  uploading?: boolean;
  disabled?: boolean;
  onSelectFile: (file: File) => void;
  onRemove?: () => void;
};

export function AvatarPicker({ avatarPath, fallbackLabel, uploading = false, disabled = false, onSelectFile, onRemove }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canInteract = !disabled && !uploading;

  return (
    <div className="relative w-fit">
      {avatarPath && onRemove ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={onRemove}
          disabled={!canInteract}
          aria-label="Remove avatar"
          className="absolute -right-1 -top-1 z-10 h-7 w-7 rounded-full border border-background shadow-sm transition hover:scale-105 hover:bg-destructive/85"
        >
          <Trash2 className="h-3.5 w-3.5 text-white" />
        </Button>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!canInteract}
        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Change avatar"
      >
        {avatarPath ? (
          <Image src={avatarPath} alt="Avatar" fill unoptimized className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">{fallbackLabel}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-4 w-4 text-white" />
        </span>
      </button>

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
