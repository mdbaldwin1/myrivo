import type { CardStyle, RadiusScale } from "@/lib/theme/storefront-theme";

const STOREFRONT_RADIUS_CLASSES: Record<RadiusScale, string> = {
  soft: "rounded-2xl",
  rounded: "rounded-xl",
  sharp: "rounded-none"
};

const STOREFRONT_BUTTON_RADIUS_CLASSES: Record<RadiusScale, string> = {
  soft: "!rounded-2xl",
  rounded: "!rounded-xl",
  sharp: "!rounded-none"
};

const STOREFRONT_CARD_STYLE_CLASSES: Record<CardStyle, string> = {
  solid: "border border-border bg-[color:var(--storefront-surface)] shadow-sm",
  outline: "border-2 border-border bg-transparent",
  elevated: "border border-border bg-[color:var(--storefront-surface)] shadow-[0_10px_28px_rgba(var(--storefront-primary-rgb),0.18)]",
  integrated: "border-0 bg-transparent shadow-none"
};

export function getStorefrontRadiusClass(radiusScale: RadiusScale) {
  return STOREFRONT_RADIUS_CLASSES[radiusScale];
}

export function getStorefrontButtonRadiusClass(radiusScale: RadiusScale) {
  return STOREFRONT_BUTTON_RADIUS_CLASSES[radiusScale];
}

export function getStorefrontCardStyleClass(cardStyle: CardStyle) {
  return STOREFRONT_CARD_STYLE_CLASSES[cardStyle];
}
