"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { digitalFileLabel, validateDigitalFile } from "@/lib/digital-products/upload-asset";

export type StagedDigitalFile = {
  id: string;
  file: File;
  label: string;
};

type StagedDigitalFilesProps = {
  /** Whether the unit these files belong to is a variant or one of its options. */
  noun: "variant" | "option";
  files: StagedDigitalFile[];
  onChange: (files: StagedDigitalFile[]) => void;
};

function fileTypeLabel(mimeType: string) {
  if (mimeType === "image/jpeg") return "JPG";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/zip") return "ZIP";
  return "File";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / 1024 / 1024;
  return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

/**
 * Customer downloads for a variant that does not exist yet. The files stay in
 * the browser and upload when the product is saved, so a merchant can build a
 * whole variant in one pass instead of saving midway to earn the right to
 * attach anything.
 */
export function StagedDigitalFiles({ noun, files, onChange }: StagedDigitalFilesProps) {
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(selected: File[]) {
    setError(null);
    if (files.length + selected.length > DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct) {
      setError(`You can attach up to ${DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct} customer files to a product.`);
      return;
    }
    const invalid = selected.map((file) => ({ file, error: validateDigitalFile(file) })).find((entry) => entry.error);
    if (invalid?.error) {
      setError(`${invalid.file.name}: ${invalid.error}`);
      return;
    }
    onChange([
      ...files,
      ...selected.map((file, index) => ({
        id: `staged-${file.name}-${file.lastModified}-${files.length + index}`,
        file,
        label: digitalFileLabel(file.name),
      })),
    ]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  const addDisabled = files.length >= DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold">Customer downloads</h4>
          <p className="text-xs text-muted-foreground">
            Originals stay private. Buyers who purchase this {noun} receive these files.
          </p>
        </div>
        <label
          title="Add files"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${addDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={addDisabled}
            accept={Object.keys(DIGITAL_PRODUCT_CONFIG.acceptedFiles).join(",")}
            className="sr-only"
            aria-label="Add customer download files"
            onChange={(event) => {
              const selected = [...(event.target.files ?? [])];
              if (selected.length > 0) addFiles(selected);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {files.length} of {DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct} files · JPG, PNG, PDF, or ZIP · 250 MB each
      </p>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {files.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          No files yet. Anything you add uploads when you save the product.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {files.map((staged, index) => (
              <li
                key={staged.id}
                aria-label={staged.label}
                className="flex flex-col gap-2 rounded-md border border-border bg-white p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  {renamingId === staged.id ? (
                    <Input
                      autoFocus
                      aria-label={`Rename ${staged.label}`}
                      defaultValue={staged.label}
                      className="h-7 text-sm"
                      onBlur={(event) => {
                        const label = event.target.value.trim();
                        setRenamingId(null);
                        if (label && label !== staged.label) {
                          onChange(files.map((entry) => (entry.id === staged.id ? { ...entry, label } : entry)));
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                      title="Rename"
                      onClick={() => setRenamingId(staged.id)}
                    >
                      {staged.label}
                    </button>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {staged.file.name} · {fileTypeLabel(staged.file.type)} · {fileSizeLabel(staged.file.size)} · Uploads on save
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    aria-label={`Move ${staged.label} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    aria-label={`Move ${staged.label} down`}
                    disabled={index === files.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    aria-label={`Remove ${staged.label}`}
                    onClick={() => onChange(files.filter((entry) => entry.id !== staged.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            These upload when you save the product. You can confirm distribution rights afterwards.
          </p>
        </>
      )}
    </div>
  );
}
