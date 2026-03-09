import {
  ClipboardList,
  Home,
  Info,
  Mail,
  Package,
  Shield,
  ShoppingCart,
  type LucideIcon
} from "lucide-react";

export const storefrontStudioSurfaceIds = ["home", "products", "about", "policies", "cart", "orderSummary", "emails"] as const;

export type StorefrontStudioSurfaceId = (typeof storefrontStudioSurfaceIds)[number];

export type StorefrontStudioSurface = {
  id: StorefrontStudioSurfaceId;
  label: string;
  description: string;
  previewLabel: string;
  previewHref: (storeSlug: string) => string;
  icon: LucideIcon;
  qualityChecklist: string[];
};

export const storefrontStudioSurfaces: readonly StorefrontStudioSurface[] = [
  {
    id: "home",
    label: "Home Page",
    description: "Hero, announcement, merchandising blocks, and top-of-funnel storefront messaging.",
    previewLabel: "Live storefront home",
    previewHref: (storeSlug) => `/s/${storeSlug}`,
    icon: Home,
    qualityChecklist: ["Keep the announcement bar concise.", "Confirm hero copy explains the store in one scan.", "Use content blocks to support the primary CTA."]
  },
  {
    id: "products",
    label: "Products Page",
    description: "Grid presentation, review visibility, and merchandising copy around the catalog experience.",
    previewLabel: "Home grid preview",
    previewHref: (storeSlug) => `/s/${storeSlug}`,
    icon: Package,
    qualityChecklist: ["Match product-grid tone to the home page.", "Use reviews only when they improve confidence.", "Avoid duplicate headlines between hero and catalog."]
  },
  {
    id: "about",
    label: "About Page",
    description: "Brand story, supporting sections, and trust-building editorial content.",
    previewLabel: "Live about page",
    previewHref: (storeSlug) => `/s/${storeSlug}/about`,
    icon: Info,
    qualityChecklist: ["Lead with the strongest differentiator.", "Keep section layouts visually varied.", "Use images to support trust, not just decoration."]
  },
  {
    id: "policies",
    label: "Policies",
    description: "Support email, shipping/returns expectations, and FAQ clarity.",
    previewLabel: "Live policies page",
    previewHref: (storeSlug) => `/policies?store=${encodeURIComponent(storeSlug)}`,
    icon: Shield,
    qualityChecklist: ["Answer the top buyer concerns first.", "Use FAQs for exceptions and edge cases.", "Keep policy tone direct and operational."]
  },
  {
    id: "cart",
    label: "Cart Page",
    description: "Pre-checkout messaging, reassurance, and conversion support inside the cart.",
    previewLabel: "Live cart page",
    previewHref: (storeSlug) => `/cart?store=${encodeURIComponent(storeSlug)}`,
    icon: ShoppingCart,
    qualityChecklist: ["Use cart copy to remove hesitation.", "Keep promotional messaging secondary to checkout clarity.", "Check that shipping expectations are explicit."]
  },
  {
    id: "orderSummary",
    label: "Order Summary",
    description: "Checkout-stage headings and post-selection messaging around order confirmation.",
    previewLabel: "Live checkout page",
    previewHref: (storeSlug) => `/checkout?store=${encodeURIComponent(storeSlug)}`,
    icon: ClipboardList,
    qualityChecklist: ["Headings should support fast confirmation.", "Avoid introducing new promises in checkout.", "Keep support instructions short and action-oriented."]
  },
  {
    id: "emails",
    label: "Emails",
    description: "Newsletter capture visibility and subscriber-facing microcopy.",
    previewLabel: "Storefront footer module",
    previewHref: (storeSlug) => `/s/${storeSlug}`,
    icon: Mail,
    qualityChecklist: ["Headline should state the subscriber benefit.", "Description should stay under two short sentences.", "Success messaging should reinforce the next expected email touchpoint."]
  }
] as const;

export function normalizeStorefrontStudioSurface(value: string | null | undefined): StorefrontStudioSurfaceId {
  return storefrontStudioSurfaceIds.includes(value as StorefrontStudioSurfaceId) ? (value as StorefrontStudioSurfaceId) : "home";
}

export function getStorefrontStudioSurface(surfaceId: StorefrontStudioSurfaceId) {
  const surface = storefrontStudioSurfaces.find((entry) => entry.id === surfaceId);
  if (surface) {
    return surface;
  }

  return storefrontStudioSurfaces[0] as StorefrontStudioSurface;
}
