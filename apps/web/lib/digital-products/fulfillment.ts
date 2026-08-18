import type { ProductType } from "./types";

/**
 * How a purchase reaches its buyer.
 *
 * A product carries a default, and a variant may override it, so one painting
 * can be sold as a download, as a print in the post, and as the original canvas
 * without being three separate products.
 *
 * Which of the two to ask depends on the question:
 *
 * - Acting on a line a buyer is buying - pricing it, deciding whether an
 *   address is needed, delivering it - asks the variant, via
 *   `resolveVariantFulfillment`.
 * - Asking whether a product involves digital delivery at all - whether it
 *   needs distribution rights, a buyer preview, or file management - asks the
 *   product, via `productInvolvesDigital`.
 *
 * Reading the product where the line was meant would quietly treat a print as a
 * download, or refuse to ship the original.
 */
export type FulfillmentType = ProductType;

export function resolveVariantFulfillment(
  productType: ProductType | null | undefined,
  variantFulfillmentType: FulfillmentType | null | undefined,
): FulfillmentType {
  return variantFulfillmentType ?? productType ?? "physical";
}

export function productInvolvesDigital(input: {
  productType: ProductType | null | undefined;
  variants?: ReadonlyArray<{ fulfillmentType?: FulfillmentType | null }> | null;
}): boolean {
  if ((input.variants ?? []).some((variant) => variant.fulfillmentType === "digital")) return true;
  if (!input.variants || input.variants.length === 0) return input.productType === "digital";
  // A product whose every variant is explicitly physical no longer involves
  // digital delivery, whatever its own default says.
  return input.variants.some(
    (variant) => resolveVariantFulfillment(input.productType, variant.fulfillmentType) === "digital",
  );
}

/** True when a buyer needs to tell us where to send something. */
export function requiresShipping(
  lines: ReadonlyArray<{ fulfillmentType: FulfillmentType }>,
): boolean {
  return lines.some((line) => line.fulfillmentType === "physical");
}
