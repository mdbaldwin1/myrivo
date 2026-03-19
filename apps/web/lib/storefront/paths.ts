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

export function buildStorefrontHomePath(storeSlug: string) {
  return `/s/${normalizeStoreSlug(storeSlug)}`;
}

export function buildStorefrontSubpagePath(storeSlug: string, subpage: StorefrontSubpage) {
  return `${buildStorefrontHomePath(storeSlug)}/${subpage}`;
}

export function buildStorefrontProductsPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "products");
}

export function buildStorefrontProductPath(storeSlug: string, productId: string) {
  return `${buildStorefrontProductsPath(storeSlug)}/${encodeURIComponent(productId)}`;
}

export function buildStorefrontAboutPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "about");
}

export function buildStorefrontPoliciesPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "policies");
}

export function buildStorefrontPrivacyPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "privacy");
}

export function buildStorefrontPrivacyRequestPath(storeSlug: string) {
  return `${buildStorefrontPrivacyPath(storeSlug)}/request`;
}

export function buildStorefrontTermsPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "terms");
}

export function buildStorefrontCookiesPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "cookies");
}

export function buildStorefrontCartPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "cart");
}

export function buildStorefrontCheckoutPath(storeSlug: string) {
  return buildStorefrontSubpagePath(storeSlug, "checkout");
}
