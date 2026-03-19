import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformLegalDocumentKey } from "@/lib/legal/document-keys";

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
    .in("legal_documents.key", [getPlatformLegalDocumentKey("terms"), getPlatformLegalDocumentKey("privacy")])
    .order("published_at", { ascending: false })
    .returns<LegalVersionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const resolved = (data ?? []).reduce<{ terms: LegalRequirement | null; privacy: LegalRequirement | null }>(
    (acc, row) => {
      const key = row.legal_documents?.key;
      if (key !== "platform_terms" && key !== "platform_privacy") {
        return acc;
      }
      const normalizedKey = key === "platform_terms" ? "terms" : "privacy";
      if (acc[normalizedKey]) {
        return acc;
      }
      acc[normalizedKey] = {
        documentId: row.legal_document_id,
        versionId: row.id,
        key: normalizedKey,
        title: row.legal_documents?.title ?? normalizedKey
      };
      return acc;
    },
    { terms: null, privacy: null }
  );

  return resolved;
}

type LegalContentRow = {
  id?: string;
  content_markdown: string;
  version_label: string;
  published_at: string | null;
  effective_at?: string | null;
  is_required?: boolean;
  legal_documents: { title: string; key: string } | null;
};

export async function getPublishedLegalDocumentByKey(supabase: SupabaseClient, key: "terms" | "privacy") {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("content_markdown,version_label,published_at,legal_documents!inner(title,key)")
    .eq("status", "published")
    .eq("legal_documents.key", getPlatformLegalDocumentKey(key))
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<LegalContentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getLegalDocumentVersionById(supabase: SupabaseClient, versionId: string) {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id,content_markdown,version_label,published_at,effective_at,is_required,legal_documents!inner(title,key)")
    .eq("id", versionId)
    .maybeSingle<LegalContentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
