export type CheckoutComposition = "digital_only" | "physical_only" | "mixed";

export type CheckoutCompositionItem = {
  productType: "physical" | "digital";
};

export function resolveCheckoutComposition(
  items: readonly CheckoutCompositionItem[]
): CheckoutComposition {
  if (items.length === 0) {
    throw new Error("Checkout composition requires at least one item.");
  }

  let hasDigitalItems = false;
  let hasPhysicalItems = false;

  for (const item of items) {
    if (item.productType === "digital") {
      hasDigitalItems = true;
    } else if (item.productType === "physical") {
      hasPhysicalItems = true;
    } else {
      throw new Error("Checkout composition contains an unsupported product type.");
    }
  }

  if (hasDigitalItems && hasPhysicalItems) {
    return "mixed";
  }

  return hasDigitalItems ? "digital_only" : "physical_only";
}
