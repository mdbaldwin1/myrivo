type StorefrontSubpage =
  | "products"
  | "about"
  | "policies"
  | "privacy"
  | "terms"
  | "cookies"
  | "cart"
  | "checkout";

function normalizeStoreSlug(storeSlug: string) {
  return encodeURIComponent(storeSlug.trim().toLowerCase());
}

function normalizeStorefrontRouteBasePath(routeBasePath?: string | null) {
  if (routeBasePath == null) {
    return "";
  }

  const trimmed = routeBasePath.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function resolveStorefrontRouteBasePath(storeSlug: string, routeBasePath?: string | null) {
  if (routeBasePath == null) {
    return `/s/${normalizeStoreSlug(storeSlug)}`;
  }

  const normalizedRouteBasePath = normalizeStorefrontRouteBasePath(routeBasePath);
  return normalizedRouteBasePath;
}

export function buildStorefrontHomePath(storeSlug: string, routeBasePath?: string | null) {
  return resolveStorefrontRouteBasePath(storeSlug, routeBasePath) || "/";
}

export function buildStorefrontSubpagePath(storeSlug: string, subpage: StorefrontSubpage, routeBasePath?: string | null) {
  const homePath = buildStorefrontHomePath(storeSlug, routeBasePath);
  return homePath === "/" ? `/${subpage}` : `${homePath}/${subpage}`;
}

export function buildStorefrontProductsPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "products", routeBasePath);
}

export function buildStorefrontProductPath(storeSlug: string, productId: string, routeBasePath?: string | null) {
  return `${buildStorefrontProductsPath(storeSlug, routeBasePath)}/${encodeURIComponent(productId)}`;
}

export function buildStorefrontAboutPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "about", routeBasePath);
}

export function buildStorefrontPoliciesPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "policies", routeBasePath);
}

export function buildStorefrontPrivacyPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "privacy", routeBasePath);
}

export function buildStorefrontPrivacyRequestPath(storeSlug: string, routeBasePath?: string | null) {
  return `${buildStorefrontPrivacyPath(storeSlug, routeBasePath)}/request`;
}

export function buildStorefrontTermsPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "terms", routeBasePath);
}

export function buildStorefrontCookiesPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "cookies", routeBasePath);
}

export function buildStorefrontCartPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "cart", routeBasePath);
}

export function buildStorefrontCheckoutPath(storeSlug: string, routeBasePath?: string | null) {
  return buildStorefrontSubpagePath(storeSlug, "checkout", routeBasePath);
}
