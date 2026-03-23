function normalizeDashboardPathname(pathname: string | null | undefined): string | null {
  if (!pathname) {
    return null;
  }

  try {
    const url = pathname.startsWith("/") ? new URL(pathname, "http://localhost") : new URL(pathname, "http://localhost");
    return url.pathname.replace(/\/$/, "") || "/";
  } catch {
    return pathname.replace(/\/$/, "") || "/";
  }
}

export function getStoreSlugFromDashboardPathname(pathname: string | null | undefined): string | null {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  if (!normalizedPathname) {
    return null;
  }

  const match = normalizedPathname.match(/^\/dashboard\/stores\/([^/]+)/);
  return match?.[1] ?? null;
}

export function resolveCurrentStoreWorkspaceSlug(
  pathname: string | null | undefined,
  fallbackStoreSlug: string | null | undefined
): string | null {
  return getStoreSlugFromDashboardPathname(pathname) ?? fallbackStoreSlug ?? null;
}

export function isStoreWorkspacePath(pathname: string | null | undefined, storeSlug: string | null | undefined): boolean {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  if (!normalizedPathname || !storeSlug) {
    return false;
  }

  return normalizedPathname === `/dashboard/stores/${storeSlug}` || normalizedPathname.startsWith(`/dashboard/stores/${storeSlug}/`);
}

export function isDashboardOnboardingPath(pathname: string | null | undefined): boolean {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  if (!normalizedPathname) {
    return false;
  }

  return (
    normalizedPathname === "/dashboard/stores/onboarding/new" ||
    /^\/dashboard\/stores\/[^/]+\/onboarding(?:\/.*)?$/i.test(normalizedPathname)
  );
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
