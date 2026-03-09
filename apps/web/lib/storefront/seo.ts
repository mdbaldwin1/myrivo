import { headers } from "next/headers";
import { resolvePrimaryDomainForStoreSlug, resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

function normalizeProto(rawProto: string | null): "http" | "https" {
  if (!rawProto) {
    return "https";
  }
  return rawProto.toLowerCase() === "http" ? "http" : "https";
}

function isLocalHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.startsWith("[::1]") ||
    normalizedHost.endsWith(".local")
  );
}

export async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = normalizeProto(requestHeaders.get("x-forwarded-proto"));
  return `${proto}://${host}`;
}

export async function getRequestHost() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
}

export async function buildStorefrontCanonicalUrl(pathname: string, requestedStoreSlug?: string | null) {
  const origin = await getRequestOrigin();
  const host = await getRequestHost();
  const customDomainStoreSlug = await resolveStoreSlugFromDomain(host);
  const resolvedStoreSlug = customDomainStoreSlug ?? requestedStoreSlug ?? null;
  const requestHeaders = await headers();
  const proto = normalizeProto(requestHeaders.get("x-forwarded-proto"));

  if (resolvedStoreSlug) {
    const primaryDomain = await resolvePrimaryDomainForStoreSlug(resolvedStoreSlug);
    if (primaryDomain) {
      return `${proto}://${primaryDomain}${pathname}`;
    }
  }

  if (requestedStoreSlug) {
    return `${origin}${pathname}?store=${encodeURIComponent(requestedStoreSlug)}`;
  }

  return `${origin}${pathname}`;
}

export async function resolveStorefrontCanonicalRedirect(pathname: string, requestedStoreSlug?: string | null) {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const host = await getRequestHost();
  if (!host || isLocalHost(host)) {
    return null;
  }

  const customDomainStoreSlug = await resolveStoreSlugFromDomain(host);
  const resolvedStoreSlug = customDomainStoreSlug ?? requestedStoreSlug ?? null;
  if (!resolvedStoreSlug) {
    return null;
  }

  const primaryDomain = await resolvePrimaryDomainForStoreSlug(resolvedStoreSlug);
  if (!primaryDomain || !host || host.toLowerCase() === primaryDomain.toLowerCase()) {
    return null;
  }

  const requestHeaders = await headers();
  const proto = normalizeProto(requestHeaders.get("x-forwarded-proto"));
  return `${proto}://${primaryDomain}${pathname}`;
}
