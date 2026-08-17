/**
 * Buyer-facing imagery for a product.
 *
 * A digital product's own `image_urls` can be the artwork it sells, and every
 * buyer surface is right-clickable, so a digital product is represented only by
 * its watermarked preview - never by its uploaded images. Physical products are
 * unaffected.
 */
export function resolveBuyerProductImages(input: {
  productType?: "physical" | "digital" | null;
  digitalPreviewUrl?: string | null;
  candidates: Array<string | null | undefined>;
}): string[] {
  if ((input.productType ?? "physical") === "digital") {
    return input.digitalPreviewUrl ? [input.digitalPreviewUrl] : [];
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of input.candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    unique.push(candidate);
  }
  return unique;
}
