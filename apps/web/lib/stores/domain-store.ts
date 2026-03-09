import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeHost } from "@/lib/stores/domain-utils";

type StoreDomainLookupRow = {
  domain: string;
  verification_status: "pending" | "verified" | "failed";
  stores:
    | {
        slug: string;
        status: "draft" | "pending_review" | "active" | "suspended";
      }
    | Array<{ slug: string; status: "draft" | "pending_review" | "active" | "suspended" }>;
};

async function lookupStoreSlugForDomain(domain: string): Promise<string | null> {
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
  if (!store || store.status !== "active") {
    return null;
  }

  return store.slug;
}

export async function resolveStoreSlugFromDomain(host: string | null | undefined): Promise<string | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return null;
  }

  const exactMatch = await lookupStoreSlugForDomain(normalizedHost);
  if (exactMatch) {
    return exactMatch;
  }

  if (normalizedHost.startsWith("www.")) {
    return lookupStoreSlugForDomain(normalizedHost.slice(4));
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
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "active" | "suspended" }>();

  if (storeError || !store || store.status !== "active") {
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
