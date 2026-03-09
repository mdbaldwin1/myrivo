import type { SupabaseClient } from "@supabase/supabase-js";

export type LegalRequirement = {
  documentId: string;
  versionId: string;
  key: "terms" | "privacy";
  title: string;
};

type LegalVersionRow = {
  id: string;
  legal_document_id: string;
  legal_documents: { key: string; title: string } | null;
};

export async function getSignupLegalRequirements(supabase: SupabaseClient): Promise<{
  terms: LegalRequirement | null;
  privacy: LegalRequirement | null;
}> {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id,legal_documents!inner(key,title)")
    .eq("status", "published")
    .eq("is_required", true)
    .in("legal_documents.key", ["terms", "privacy"])
    .order("published_at", { ascending: false })
    .returns<LegalVersionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const resolved = (data ?? []).reduce<{ terms: LegalRequirement | null; privacy: LegalRequirement | null }>(
    (acc, row) => {
      const key = row.legal_documents?.key;
      if (key !== "terms" && key !== "privacy") {
        return acc;
      }
      if (acc[key]) {
        return acc;
      }
      acc[key] = {
        documentId: row.legal_document_id,
        versionId: row.id,
        key,
        title: row.legal_documents?.title ?? key
      };
      return acc;
    },
    { terms: null, privacy: null }
  );

  return resolved;
}

type LegalContentRow = {
  content_markdown: string;
  version_label: string;
  published_at: string | null;
  legal_documents: { title: string; key: string } | null;
};

export async function getPublishedLegalDocumentByKey(supabase: SupabaseClient, key: "terms" | "privacy") {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("content_markdown,version_label,published_at,legal_documents!inner(title,key)")
    .eq("status", "published")
    .eq("legal_documents.key", key)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<LegalContentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
