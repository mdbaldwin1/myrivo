"use client";

import { MoreHorizontal, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isWatermarkedProductImage } from "@/lib/digital-products/watermarked-images";
import { notify } from "@/lib/feedback/toast";

/**
 * What a merchant can do with one storefront image.
 *
 * Watermarking is offered on every image because a merchant selling artwork
 * often wants the picture buyers browse to be the picture they are buying, and
 * a watermark is what makes showing it safe. It rewrites the image in the
 * draft; nothing is committed until the product is saved.
 */
export function ProductImageActions({
  imageUrl,
  label,
  isFeatured,
  onFeature,
  onReplace,
  onWatermarked,
  onRemove,
}: {
  imageUrl: string;
  /** Names this image for assistive tech, e.g. "product image 2". */
  label: string;
  isFeatured: boolean;
  onFeature: () => void;
  /** Swaps this image for another. Omitted where a grid cannot replace. */
  onReplace?: () => void;
  onWatermarked: (publicUrl: string) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const watermarked = isWatermarkedProductImage(imageUrl);

  async function setWatermark(mode: "add" | "remove") {
    setBusy(true);
    try {
      const response = await fetch("/api/products/images/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: imageUrl, mode }),
      });
      const payload = (await response.json().catch(() => null)) as { publicUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.publicUrl) {
        throw new Error(payload?.error ?? "Unable to update this image.");
      }
      onWatermarked(payload.publicUrl);
      notify.success(
        mode === "add"
          ? "Watermark added. Save the product to keep it."
          : "Original restored. Save the product to keep it.",
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to update this image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {isFeatured ? (
        <span
          className="pointer-events-none absolute left-1 top-1 rounded-full bg-white/90 p-1 text-amber-500"
          title="Featured image"
        >
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          <span className="sr-only">Featured image</span>
        </span>
      ) : null}
      {/* Non-modal: a menu item can raise a toast or a dialog, and a modal
          menu's pointer-events lock can outlive the menu, leaving the page
          unclickable. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={busy}
            className="absolute right-1 top-1 z-10 h-7 w-7 bg-white/90 hover:bg-white"
            aria-label={`Manage ${label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        {/* A portal still bubbles through the React tree, so without this the
            tile behind the menu treats a menu click as a click on itself and
            opens its file picker. */}
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          {/* The star already says which image is featured; a dead menu entry
              saying so again is noise. */}
          {isFeatured ? null : <DropdownMenuItem onClick={onFeature}>Feature</DropdownMenuItem>}
          {onReplace ? <DropdownMenuItem onClick={onReplace}>Replace image</DropdownMenuItem> : null}
          {/* A watermark is burned into the pixels, so removing it means going
              back to the original this copy was made from. */}
          <DropdownMenuItem onClick={() => void setWatermark(watermarked ? "remove" : "add")}>
            {busy ? "Working…" : watermarked ? "Remove watermark" : "Add watermark"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={onRemove}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
