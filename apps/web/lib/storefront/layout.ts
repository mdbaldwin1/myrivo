import type { PageWidth, SpacingScale } from "@/lib/theme/storefront-theme";

const PAGE_WIDTH_CLASSES: Record<PageWidth, string> = {
  narrow: "max-w-5xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl"
};

const SPACING_SCALE_CLASSES: Record<SpacingScale, string> = {
  compact: "space-y-5 px-4 py-6 sm:px-6 sm:py-8",
  comfortable: "space-y-6 px-4 py-7 sm:px-6 sm:py-9 lg:space-y-8 lg:py-10",
  airy: "space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:space-y-10 lg:py-12"
};

export function getStorefrontPageWidthClass(pageWidth: PageWidth) {
  return PAGE_WIDTH_CLASSES[pageWidth];
}

export function getStorefrontPageSpacingClass(spacingScale: SpacingScale) {
  return SPACING_SCALE_CLASSES[spacingScale];
}

export function getStorefrontPageShellClass(pageWidth: PageWidth, spacingScale: SpacingScale) {
  return `mx-auto w-full ${getStorefrontPageWidthClass(pageWidth)} ${getStorefrontPageSpacingClass(spacingScale)}`;
}
