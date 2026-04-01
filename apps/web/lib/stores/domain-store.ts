import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/stores/domain-utils";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

type StoreDomainLookupRow = {
  domain: string;
  verification_status: "pending" | "verified" | "failed";
  stores:
    | {
        slug: string;
        status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
      }
    | Array<{ slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>;
};

type ResolveStoreSlugFromDomainOptions = {
  includeNonPublic?: boolean;
};

async function lookupStoreSlugForDomain(domain: string, options?: ResolveStoreSlugFromDomainOptions): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("store_domains")
    .select("domain,verification_status,stores!inner(slug,status)")
    .eq("domain", domain)
    .eq("verification_status", "verified")
    .maybeSingle<StoreDomainLookupRow>();

  if (error || !data?.stores) {
    return null;
  }

  const store = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  if (!store) {
    return null;
  }

  if (!options?.includeNonPublic && !isStorePubliclyAccessibleStatus(store.status)) {
    return null;
  }

  return store.slug;
}

export async function resolveStoreSlugFromDomain(
  host: string | null | undefined,
  options?: ResolveStoreSlugFromDomainOptions
): Promise<string | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return null;
  }

  // Never resolve the app's own domain as a custom storefront domain.
  try {
    const appHost = new URL(getAppUrl()).hostname;
    const bare = normalizedHost.startsWith("www.") ? normalizedHost.slice(4) : normalizedHost;
    const bareApp = appHost.startsWith("www.") ? appHost.slice(4) : appHost;
    if (bare === bareApp) {
      return null;
    }
  } catch {
    // If getAppUrl() throws (missing env), fall through — dev environments
    // without the env var won't accidentally match production domains.
  }

  const exactMatch = await lookupStoreSlugForDomain(normalizedHost, options);
  if (exactMatch) {
    return exactMatch;
  }

  if (normalizedHost.startsWith("www.")) {
    return lookupStoreSlugForDomain(normalizedHost.slice(4), options);
  }

  return null;
}

export async function resolvePrimaryDomainForStoreSlug(storeSlug: string): Promise<string | null> {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,status")
    .eq("slug", normalizedSlug)
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (storeError || !store || !isStorePubliclyAccessibleStatus(store.status)) {
    return null;
  }

  const { data: domainRow, error: domainError } = await admin
    .from("store_domains")
    .select("domain")
    .eq("store_id", store.id)
    .eq("verification_status", "verified")
    .eq("is_primary", true)
    .maybeSingle<{ domain: string }>();

  if (domainError || !domainRow?.domain) {
    return null;
  }

  return domainRow.domain;
}
