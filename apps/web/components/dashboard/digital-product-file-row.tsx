"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  ListerActionsMenu,
  ListerRow,
  ListerRowBody,
  ListerRowControls,
  ListerRowLabel,
  ListerRowMain,
  ListerRowMeta,
} from "@/components/dashboard/lister";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  DigitalProductAsset,
  DigitalProductFileVariant,
} from "@/components/dashboard/digital-product-files";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";

type DigitalProductFileRowProps = {
  asset: DigitalProductAsset;
  variants: DigitalProductFileVariant[];
  /** Placement already fixes which unit this file belongs to. */
  scopeLocked?: boolean;
  index: number;
  count: number;
  busy: boolean;
  onRename: (label: string) => void | Promise<void>;
  onAssign: (productVariantId: string | null) => void | Promise<void>;
  onMove: (direction: -1 | 1) => void | Promise<void>;
  onReplace: (file: File, returnFocus: HTMLButtonElement | null) => void;
  onRemove: () => void;
};

function latestVersion(asset: DigitalProductAsset) {
  return [...asset.digital_product_asset_versions].sort(
    (left, right) => right.version_number - left.version_number,
  )[0];
}

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

function statusLabel(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function DigitalProductFileRow({
  asset,
  variants,
  index,
  count,
  busy,
  onRename,
  onAssign,
  scopeLocked = false,
  onMove,
  onReplace,
  onRemove,
}: DigitalProductFileRowProps) {
  const version = latestVersion(asset);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(asset.label);
  const replacementRef = useRef<HTMLInputElement | null>(null);
  const actionsRef = useRef<HTMLButtonElement | null>(null);
  return (
    <ListerRow label={asset.label}>
      <div className="flex flex-col gap-2">
        <ListerRowBody>
          <ListerRowMain>
            {renaming ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                  Customer-facing label
                  <Input
                    autoFocus
                    maxLength={160}
                    value={draftLabel}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setDraftLabel(asset.label);
                        setRenaming(false);
                      }
                    }}
                    className="mt-1"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !draftLabel.trim()}
                    onClick={async () => {
                      await onRename(draftLabel.trim());
                      setRenaming(false);
                    }}
                  >
                    Save label
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraftLabel(asset.label);
                      setRenaming(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ListerRowLabel title="Rename this file" disabled={busy} onClick={() => setRenaming(true)}>
                    {asset.label}
                  </ListerRowLabel>
                  {version ? (
                    <Badge
                      variant="outline"
                      className={
                        version.status === "ready"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : version.status === "failed"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                      }
                    >
                      {statusLabel(version.status)}
                    </Badge>
                  ) : null}
                </div>
                <ListerRowMeta>
                  {version
                    ? `${version.customer_filename} · ${fileTypeLabel(version.mime_type)} · ${fileSizeLabel(version.byte_size)} · v${version.version_number}`
                    : "Preparing file metadata"}
                </ListerRowMeta>
                {version?.failure_reason ? <p className="text-xs text-destructive">{version.failure_reason}</p> : null}
              </>
            )}
          </ListerRowMain>

          <ListerRowControls>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label={`Move ${asset.label} up`}
              disabled={busy || index === 0}
              onClick={() => void onMove(-1)}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label={`Move ${asset.label} down`}
              disabled={busy || index === count - 1}
              onClick={() => void onMove(1)}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <ListerActionsMenu
              label={asset.label}
              disabled={busy}
              triggerRef={actionsRef}
              actions={[
                { label: "Rename", onSelect: () => setRenaming(true) },
                { label: "Replace file", onSelect: () => replacementRef.current?.click() },
                { label: "Remove file", onSelect: onRemove, destructive: true },
              ]}
            />
          </ListerRowControls>
        </ListerRowBody>

        <input
          ref={replacementRef}
          type="file"
          className="sr-only"
          accept={Object.keys(DIGITAL_PRODUCT_CONFIG.acceptedFiles).join(",")}
          aria-label={`Choose a replacement for ${asset.label}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReplace(file, actionsRef.current);
            event.target.value = "";
          }}
        />

        {/* Placement fixes the scope when this list belongs to one unit, so the
            picker - and the rule it sat on - only appear in the unscoped list. */}
        {scopeLocked ? null : (
          <div className="border-t border-border/70 pt-3">
            <label htmlFor={`digital-file-scope-${asset.id}`} className="text-xs font-medium text-muted-foreground">
              File availability
              <Select
                id={`digital-file-scope-${asset.id}`}
                value={asset.product_variant_id ?? "all"}
                disabled={busy}
                onChange={(event) => void onAssign(event.target.value === "all" ? null : event.target.value)}
                className="mt-1"
              >
                <option value="all">All variants</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}{variant.status === "archived" ? " (archived)" : ""}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        )}

      </div>
    </ListerRow>
  );
}
