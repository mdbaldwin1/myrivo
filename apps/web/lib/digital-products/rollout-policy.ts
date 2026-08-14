export type CheckoutComposition = "physical_only" | "digital_only" | "mixed" | null;

export function filterProductsForDigitalProductsRollout<
  T extends { product_type?: "physical" | "digital" | null },
>(products: T[], enabled: boolean): T[] {
  return enabled ? products : products.filter((product) => product.product_type !== "digital");
}

export function canResumeCheckoutWhenDigitalProductsDisabled(
  composition: CheckoutComposition,
  status: "pending" | "completed" | "failed",
) {
  return composition === "physical_only" || status === "completed";
}
