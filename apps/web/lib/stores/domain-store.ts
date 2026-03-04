import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizeHost(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const host = value.trim().toLowerCase().split(":")[0];
  if (!host || host === "localhost" || host.endsWith(".vercel.app")) {
    return null;
  }

  return host;
}

export async function resolveStoreSlugFromDomain(host: string | null | undefined): Promise<string | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("store_domains")
    .select("domain,verification_status,stores!inner(slug,status)")
    .eq("domain", normalizedHost)
    .eq("verification_status", "verified")
    .maybeSingle<{
      domain: string;
      verification_status: "pending" | "verified" | "failed";
      stores:
        | {
            slug: string;
            status: "draft" | "active" | "suspended";
          }
        | Array<{ slug: string; status: "draft" | "active" | "suspended" }>;
    }>();

  if (error || !data?.stores) {
    return null;
  }

  const store = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  if (!store || store.status !== "active") {
    return null;
  }

  return store.slug;
}
