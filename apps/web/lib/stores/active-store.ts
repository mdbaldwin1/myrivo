import type { NextRequest } from "next/server";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { ACTIVE_STORE_COOKIE, readSelectedStoreSlugFromCookies } from "@/lib/stores/tenant-context";

function normalizeSlug(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function resolveStoreSlugForServerRender(explicitSlug?: string | null): Promise<string | null> {
  const explicit = normalizeSlug(explicitSlug);
  if (explicit) {
    return explicit;
  }

  const selected = await readSelectedStoreSlugFromCookies();
  if (selected) {
    return selected;
  }

  return null;
}

export function resolveStoreSlugFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const slugFromQuery =
    normalizeSlug(url.searchParams.get("store")) ??
    normalizeSlug(url.searchParams.get("storeSlug")) ??
    normalizeSlug(url.searchParams.get("slug"));

  if (slugFromQuery) {
    return slugFromQuery;
  }

  const slugFromHeader = normalizeSlug(request.headers.get("x-store-slug"));
  if (slugFromHeader) {
    return slugFromHeader;
  }

  const slugFromCookie = normalizeSlug(request.cookies.get(ACTIVE_STORE_COOKIE)?.value);
  if (slugFromCookie) {
    return slugFromCookie;
  }

  return null;
}

export async function resolveStoreSlugFromRequestAsync(request: NextRequest): Promise<string | null> {
  const syncResolved = resolveStoreSlugFromRequest(request);
  if (syncResolved) {
    return syncResolved;
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const fromDomain = await resolveStoreSlugFromDomain(host);
  if (fromDomain) {
    return fromDomain;
  }

  return null;
}
