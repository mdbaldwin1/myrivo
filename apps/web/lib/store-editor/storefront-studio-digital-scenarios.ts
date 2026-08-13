export const storefrontStudioDigitalScenarioIds = ["digitalOnly", "mixed"] as const;
export type StorefrontStudioDigitalScenarioId = (typeof storefrontStudioDigitalScenarioIds)[number];

const digitalProduct = {
  id: "studio-digital-download",
  title: "Digital field guide",
  product_type: "digital" as const,
  price_cents: 1800,
};
const physicalProduct = {
  id: "studio-physical-print",
  title: "Printed field guide",
  product_type: "physical" as const,
  price_cents: 2600,
};

export function buildStorefrontStudioDigitalScenario(id: StorefrontStudioDigitalScenarioId) {
  const mixed = id === "mixed";
  return {
    id,
    label: mixed ? "Mixed order" : "Digital-only order",
    products: mixed ? [digitalProduct, physicalProduct] : [digitalProduct],
    cartItems: [
      {
        productId: digitalProduct.id,
        productTitle: digitalProduct.title,
        productType: digitalProduct.product_type,
        quantity: 1,
        unitPriceCents: digitalProduct.price_cents,
      },
      ...(mixed
        ? [{
            productId: physicalProduct.id,
            productTitle: physicalProduct.title,
            productType: physicalProduct.product_type,
            quantity: 1,
            unitPriceCents: physicalProduct.price_cents,
          }]
        : []),
    ],
    orderSummary: {
      composition: mixed ? "mixed" as const : "digital_only" as const,
      fulfillment: mixed ? "Digital delivery and shipping" : "Digital delivery",
      totalCents: mixed ? 4400 : 1800,
    },
  };
}
