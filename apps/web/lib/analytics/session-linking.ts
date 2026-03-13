import { sanitizeSessionId } from "@/lib/analytics/collect";

export type StorefrontSessionLink = {
  id: string;
  sessionKey: string;
};

type QueryableSupabase = {
  from: (table: string) => unknown;
};

export async function resolveStorefrontSessionLink(
  supabase: QueryableSupabase,
  input: { storeId: string; sessionKey?: string | null }
) {
  const normalizedSessionKey = sanitizeSessionId(input.sessionKey);
  if (!normalizedSessionKey) {
    return null;
  }

  const query = supabase.from("storefront_sessions") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data, error } = await query.select("id").eq("store_id", input.storeId).eq("session_key", normalizedSessionKey).maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    sessionKey: normalizedSessionKey
  } satisfies StorefrontSessionLink;
}
