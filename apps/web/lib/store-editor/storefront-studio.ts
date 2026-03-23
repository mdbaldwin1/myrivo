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
import {
  buildStorefrontAboutPath,
  buildStorefrontCartPath,
  buildStorefrontCheckoutPath,
  buildStorefrontHomePath,
  buildStorefrontPoliciesPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";

export const storefrontStudioSurfaceIds = ["home", "products", "about", "policies", "cart", "orderSummary", "emails"] as const;

export type StorefrontStudioSurfaceId = (typeof storefrontStudioSurfaceIds)[number];
export const storefrontStudioEditorTargetIds = ["brand", "header", "footer", "productDetail", "welcomePopup"] as const;
export type StorefrontStudioEditorTargetId = (typeof storefrontStudioEditorTargetIds)[number];

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
    previewHref: (storeSlug) => buildStorefrontHomePath(storeSlug),
    icon: Home,
    qualityChecklist: ["Keep the announcement bar concise.", "Confirm hero copy explains the store in one scan.", "Use content blocks to support the primary CTA."]
  },
  {
    id: "products",
    label: "Products Page",
    description: "Grid presentation, review visibility, and merchandising copy around the catalog experience.",
    previewLabel: "Home grid preview",
    previewHref: (storeSlug) => buildStorefrontHomePath(storeSlug),
    icon: Package,
    qualityChecklist: ["Match product-grid tone to the home page.", "Use reviews only when they improve confidence.", "Avoid duplicate headlines between hero and catalog."]
  },
  {
    id: "about",
    label: "About Page",
    description: "Brand story, supporting sections, and trust-building editorial content.",
    previewLabel: "Live about page",
    previewHref: (storeSlug) => buildStorefrontAboutPath(storeSlug),
    icon: Info,
    qualityChecklist: ["Lead with the strongest differentiator.", "Keep section layouts visually varied.", "Use images to support trust, not just decoration."]
  },
  {
    id: "policies",
    label: "Policies",
    description: "Support email, shipping/returns expectations, and FAQ clarity.",
    previewLabel: "Live policies page",
    previewHref: (storeSlug) => buildStorefrontPoliciesPath(storeSlug),
    icon: Shield,
    qualityChecklist: ["Answer the top buyer concerns first.", "Use FAQs for exceptions and edge cases.", "Keep policy tone direct and operational."]
  },
  {
    id: "cart",
    label: "Cart Page",
    description: "Pre-checkout messaging, reassurance, and conversion support inside the cart.",
    previewLabel: "Live cart page",
    previewHref: (storeSlug) => buildStorefrontCartPath(storeSlug),
    icon: ShoppingCart,
    qualityChecklist: ["Use cart copy to remove hesitation.", "Keep promotional messaging secondary to checkout clarity.", "Check that shipping expectations are explicit."]
  },
  {
    id: "orderSummary",
    label: "Order Summary",
    description: "Checkout-stage headings and post-selection messaging around order confirmation.",
    previewLabel: "Live checkout page",
    previewHref: (storeSlug) => buildStorefrontCheckoutPath(storeSlug),
    icon: ClipboardList,
    qualityChecklist: ["Headings should support fast confirmation.", "Avoid introducing new promises in checkout.", "Keep support instructions short and action-oriented."]
  },
  {
    id: "emails",
    label: "Emails",
    description: "Newsletter capture visibility and subscriber-facing microcopy.",
    previewLabel: "Storefront footer module",
    previewHref: (storeSlug) => buildStorefrontHomePath(storeSlug),
    icon: Mail,
    qualityChecklist: ["Headline should state the subscriber benefit.", "Description should stay under two short sentences.", "Success messaging should reinforce the next expected email touchpoint."]
  }
] as const;

export function normalizeStorefrontStudioSurface(value: string | null | undefined): StorefrontStudioSurfaceId {
  return storefrontStudioSurfaceIds.includes(value as StorefrontStudioSurfaceId) ? (value as StorefrontStudioSurfaceId) : "home";
}

export function normalizeStorefrontStudioEditorTarget(value: string | null | undefined): StorefrontStudioEditorTargetId | null {
  return storefrontStudioEditorTargetIds.includes(value as StorefrontStudioEditorTargetId)
    ? (value as StorefrontStudioEditorTargetId)
    : null;
}

export function getStorefrontStudioSurface(surfaceId: StorefrontStudioSurfaceId) {
  const surface = storefrontStudioSurfaces.find((entry) => entry.id === surfaceId);
  if (surface) {
    return surface;
  }

  return storefrontStudioSurfaces[0] as StorefrontStudioSurface;
}

export function buildStorefrontStudioSurfaceHref(
  pathname: string,
  currentSearchParams: Pick<URLSearchParams, "toString">,
  surfaceId: StorefrontStudioSurfaceId
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams.toString());
  if (surfaceId === "home") {
    nextSearchParams.delete("surface");
  } else {
    nextSearchParams.set("surface", surfaceId);
  }

  const query = nextSearchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getStorefrontStudioSurfaceForHref(href: string, storeSlug: string): StorefrontStudioSurfaceId | null {
  try {
    const url = new URL(href, "https://myrivo.local");
    const pathname = url.pathname.replace(/\/$/, "") || "/";
    const storeParam = url.searchParams.get("store")?.trim() ?? "";

    if (pathname === "/" && (!storeParam || storeParam === storeSlug)) {
      return "home";
    }

    if (pathname === buildStorefrontHomePath(storeSlug) || pathname === buildStorefrontAboutPath(storeSlug)) {
      return pathname === buildStorefrontAboutPath(storeSlug) ? "about" : "home";
    }

    if (pathname === "/about" && (!storeParam || storeParam === storeSlug)) {
      return "about";
    }

    if (pathname === buildStorefrontPoliciesPath(storeSlug) || (pathname === "/policies" && (!storeParam || storeParam === storeSlug))) {
      return "policies";
    }

    if (pathname === buildStorefrontCartPath(storeSlug) || (pathname === "/cart" && (!storeParam || storeParam === storeSlug))) {
      return "cart";
    }

    if (pathname === buildStorefrontCheckoutPath(storeSlug) || (pathname === "/checkout" && (!storeParam || storeParam === storeSlug))) {
      return "orderSummary";
    }

    if (pathname === buildStorefrontProductsPath(storeSlug) || (pathname === "/products" && (!storeParam || storeParam === storeSlug))) {
      return "products";
    }

    if (
      pathname.startsWith(`${buildStorefrontProductsPath(storeSlug)}/`) ||
      (pathname.startsWith("/products/") && (!storeParam || storeParam === storeSlug))
    ) {
      return "products";
    }

    return null;
  } catch {
    return null;
  }
}

export function getStorefrontStudioProductHandleForHref(href: string, storeSlug: string): string | null {
  try {
    const url = new URL(href, "https://myrivo.local");
    const pathname = url.pathname.replace(/\/$/, "") || "/";
    const storeParam = url.searchParams.get("store")?.trim() ?? "";

    const pathBasedPrefix = `${buildStorefrontProductsPath(storeSlug)}/`;
    if (!pathname.startsWith("/products/") && !pathname.startsWith(pathBasedPrefix)) {
      return null;
    }

    if (storeParam && storeParam !== storeSlug) {
      return null;
    }

    const handle = pathname.startsWith(pathBasedPrefix)
      ? pathname.slice(pathBasedPrefix.length).trim()
      : pathname.slice("/products/".length).trim();
    return handle.length > 0 ? decodeURIComponent(handle) : null;
  } catch {
    return null;
  }
}
