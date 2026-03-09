import type { SupabaseClient } from "@supabase/supabase-js";

export type MissingRequiredLegalVersion = {
  versionId: string;
  documentId: string;
  documentKey: string;
  documentTitle: string;
  versionLabel: string;
};

type RequiredVersionRow = {
  id: string;
  legal_document_id: string;
  version_label: string;
  legal_documents: { key: string; title: string } | null;
};

export async function getMissingRequiredLegalVersions(supabase: SupabaseClient, userId: string): Promise<MissingRequiredLegalVersion[]> {
  const { data: requiredVersions, error: requiredError } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id,version_label,legal_documents!inner(key,title)")
    .eq("status", "published")
    .eq("is_required", true)
    .returns<RequiredVersionRow[]>();

  if (requiredError) {
    throw new Error(requiredError.message);
  }

  const requiredIds = (requiredVersions ?? []).map((version) => version.id);
  if (requiredIds.length === 0) {
    return [];
  }

  const { data: accepted, error: acceptedError } = await supabase
    .from("legal_acceptances")
    .select("legal_document_version_id")
    .eq("user_id", userId)
    .in("legal_document_version_id", requiredIds)
    .returns<Array<{ legal_document_version_id: string }>>();

  if (acceptedError) {
    throw new Error(acceptedError.message);
  }

  const acceptedIds = new Set((accepted ?? []).map((row) => row.legal_document_version_id));
  return (requiredVersions ?? [])
    .filter((version) => !acceptedIds.has(version.id))
    .map((version) => ({
      versionId: version.id,
      documentId: version.legal_document_id,
      documentKey: version.legal_documents?.key ?? "terms",
      documentTitle: version.legal_documents?.title ?? "Legal document",
      versionLabel: version.version_label
    }));
}
