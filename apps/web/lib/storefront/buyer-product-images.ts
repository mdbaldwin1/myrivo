import { resolveVariantFulfillment, type FulfillmentType } from "@/lib/digital-products/fulfillment";
import type { ProductType } from "@/lib/digital-products/types";

type VariantFulfillment = FulfillmentType | null | undefined;

/**
 * Buyer-facing imagery.
 *
 * What a merchant uploads for a download can be the artwork it sells, and every
 * buyer surface is one right-click away from a free copy - so a download is
 * represented only by its watermarked preview, never by uploaded images.
 *
 * The unit being shown decides this, not the product: a painting sold as a
 * download, a print, and the original canvas must still show its photographs
 * for the two you can hold. Uploaded images are withheld only when there is
 * nothing physical left to depict.
 */
export function resolveBuyerProductImages(input: {
  productType?: ProductType | null;
  /** The variant on show. Omit when the surface is not about one variant. */
  variantFulfillmentType?: VariantFulfillment;
  /** Every variant of the product, for surfaces showing the product as a whole. */
  variantFulfillmentTypes?: ReadonlyArray<VariantFulfillment>;
  digitalPreviewUrl?: string | null;
  candidates: Array<string | null | undefined>;
}): string[] {
  if (showsDigitalOnly(input)) {
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

function showsDigitalOnly(input: {
  productType?: ProductType | null;
  variantFulfillmentType?: VariantFulfillment;
  variantFulfillmentTypes?: ReadonlyArray<VariantFulfillment>;
}): boolean {
  const productType = input.productType ?? "physical";

  // A surface showing one variant answers for that variant alone.
  if (input.variantFulfillmentType !== undefined) {
    return resolveVariantFulfillment(productType, input.variantFulfillmentType) === "digital";
  }

  const variants = input.variantFulfillmentTypes;
  if (variants && variants.length > 0) {
    return variants.every((variant) => resolveVariantFulfillment(productType, variant) === "digital");
  }

  return productType === "digital";
}
