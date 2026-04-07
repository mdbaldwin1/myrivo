type StorefrontShareLinkInput = {
  appUrl: string;
  storeSlug: string;
  primaryDomain?: string | null;
  destinationPath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

function normalizePathname(value: string) {
  if (!value || value === "/") {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function normalizeShareDestinationPath(destinationPath?: string | null) {
  const trimmed = destinationPath?.trim() ?? "";
  if (!trimmed) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed);
    return `${normalizePathname(parsed.pathname)}${parsed.search}${parsed.hash}`;
  } catch {
    return normalizePathname(trimmed);
  }
}

function applyOptionalQueryParam(searchParams: URLSearchParams, key: string, value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    searchParams.delete(key);
    return;
  }

  searchParams.set(key, trimmed);
}

export function buildStorefrontShareUrl({
  appUrl,
  storeSlug,
  primaryDomain,
  destinationPath,
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent
}: StorefrontShareLinkInput) {
  const normalizedDestination = normalizeShareDestinationPath(destinationPath);
  const destination = new URL(normalizedDestination, "https://storefront.local");
  const base = primaryDomain?.trim() ? new URL(`https://${primaryDomain.trim()}`) : new URL(appUrl);

  if (!primaryDomain?.trim()) {
    base.pathname = `/s/${storeSlug}`;
  }

  const basePath = base.pathname === "/" ? "" : base.pathname.endsWith("/") ? base.pathname.slice(0, -1) : base.pathname;
  const destinationPathname = destination.pathname === "/" ? "" : destination.pathname;
  base.pathname = `${basePath}${destinationPathname}` || "/";

  const searchParams = new URLSearchParams(destination.search);
  applyOptionalQueryParam(searchParams, "utm_source", utmSource);
  applyOptionalQueryParam(searchParams, "utm_medium", utmMedium);
  applyOptionalQueryParam(searchParams, "utm_campaign", utmCampaign);
  applyOptionalQueryParam(searchParams, "utm_term", utmTerm);
  applyOptionalQueryParam(searchParams, "utm_content", utmContent);
  base.search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  base.hash = destination.hash;

  return base.toString();
}
