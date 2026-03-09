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
