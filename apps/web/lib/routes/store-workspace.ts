export function getStoreSlugFromDashboardPathname(pathname: string | null | undefined): string | null {
  if (!pathname) {
    return null;
  }

  const match = pathname.match(/^\/dashboard\/stores\/([^/]+)/);
  return match?.[1] ?? null;
}

export function buildStoreWorkspacePath(
  storeSlug: string | null | undefined,
  childPath: string,
  fallbackPath = "/dashboard/stores"
): string {
  const normalizedChildPath = childPath.startsWith("/") ? childPath : `/${childPath}`;
  if (!storeSlug) {
    return fallbackPath;
  }
  return `/dashboard/stores/${storeSlug}${normalizedChildPath}`;
}

export function buildStoreScopedApiPath(path: string, storeSlug: string | null | undefined): string {
  if (!storeSlug) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("storeSlug", storeSlug);
  return `${url.pathname}${url.search}`;
}
