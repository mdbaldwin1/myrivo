"use client";

import { MoreHorizontal, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  onWatermarked,
  onRemove,
}: {
  imageUrl: string;
  /** Names this image for assistive tech, e.g. "product image 2". */
  label: string;
  isFeatured: boolean;
  onFeature: () => void;
  onWatermarked: (publicUrl: string) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function watermark() {
    setBusy(true);
    try {
      const response = await fetch("/api/products/images/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: imageUrl }),
      });
      const payload = (await response.json().catch(() => null)) as { publicUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.publicUrl) {
        throw new Error(payload?.error ?? "Unable to watermark this image.");
      }
      onWatermarked(payload.publicUrl);
      notify.success("Watermark added. Save the product to keep it.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to watermark this image.");
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isFeatured} onClick={onFeature}>
            {isFeatured ? "Featured" : "Feature"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void watermark()}>
            {busy ? "Adding watermark…" : "Add watermark"}
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
