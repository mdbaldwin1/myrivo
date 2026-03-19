import type { SupabaseClient } from "@supabase/supabase-js";

export type LegalAdminFilters = {
  userEmail?: string;
  storeSlug?: string;
  documentKey?: string;
  versionLabel?: string;
};

export type LegalDocumentSummary = {
  id: string;
  key: string;
  title: string;
  audience: "all" | "merchant" | "customer" | "platform";
  isActive: boolean;
};

export type LegalVersionSummary = {
  id: string;
  documentId: string;
  documentKey: string;
  documentTitle: string;
  versionLabel: string;
  status: "draft" | "published" | "retired";
  isRequired: boolean;
  effectiveAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  changeSummary: string | null;
  contentMarkdown: string;
};

export type LegalAcceptanceSummary = {
  id: string;
  acceptedAt: string;
  acceptanceSurface: string;
  userId: string;
  userEmail: string | null;
  storeId: string | null;
  storeSlug: string | null;
  documentKey: string;
  documentTitle: string;
  versionLabel: string;
};

type LegalDocumentRow = {
  id: string;
  key: string;
  title: string;
  audience: "all" | "merchant" | "customer" | "platform";
  is_active: boolean;
};

type LegalVersionRow = {
  id: string;
  legal_document_id: string;
  version_label: string;
  status: "draft" | "published" | "retired";
  is_required: boolean;
  effective_at: string | null;
  published_at: string | null;
  created_at: string;
  change_summary: string | null;
  content_markdown: string;
  legal_documents: { key: string; title: string } | null;
};

type LegalAcceptanceRow = {
  id: string;
  accepted_at: string;
  acceptance_surface: string;
  user_id: string;
  store_id: string | null;
  legal_document_versions: {
    version_label: string;
    legal_documents: { key: string; title: string } | null;
  } | null;
};

export function parseLegalAdminFilters(searchParams: URLSearchParams): LegalAdminFilters {
  return {
    userEmail: searchParams.get("userEmail")?.trim() || undefined,
    storeSlug: searchParams.get("storeSlug")?.trim() || undefined,
    documentKey: searchParams.get("documentKey")?.trim() || undefined,
    versionLabel: searchParams.get("versionLabel")?.trim() || undefined
  };
}

export function buildLegalAcceptancesCsv(rows: LegalAcceptanceSummary[]) {
  const header = [
    "acceptance_id",
    "accepted_at",
    "acceptance_surface",
    "document_key",
    "document_title",
    "version_label",
    "user_id",
    "user_email",
    "store_id",
    "store_slug"
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.acceptedAt,
      row.acceptanceSurface,
      row.documentKey,
      row.documentTitle,
      row.versionLabel,
      row.userId,
      row.userEmail ?? "",
      row.storeId ?? "",
      row.storeSlug ?? ""
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}`;
}

function escapeCsvCell(value: string) {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export async function fetchLegalDocumentsAndVersions(admin: SupabaseClient) {
  const [{ data: documents, error: documentsError }, { data: versions, error: versionsError }] = await Promise.all([
    admin.from("legal_documents").select("id,key,title,audience,is_active").order("key", { ascending: true }).returns<LegalDocumentRow[]>(),
    admin
      .from("legal_document_versions")
      .select("id,legal_document_id,version_label,status,is_required,effective_at,published_at,created_at,change_summary,content_markdown,legal_documents(key,title)")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<LegalVersionRow[]>()
  ]);

  if (documentsError) {
    throw new Error(documentsError.message);
  }
  if (versionsError) {
    throw new Error(versionsError.message);
  }

  return {
    documents: (documents ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      title: row.title,
      audience: row.audience,
      isActive: row.is_active
    })) satisfies LegalDocumentSummary[],
    versions: (versions ?? []).map((row) => ({
      id: row.id,
      documentId: row.legal_document_id,
      documentKey: row.legal_documents?.key ?? "unknown",
      documentTitle: row.legal_documents?.title ?? "Legal Document",
      versionLabel: row.version_label,
      status: row.status,
      isRequired: row.is_required,
      effectiveAt: row.effective_at,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      changeSummary: row.change_summary,
      contentMarkdown: row.content_markdown
    })) satisfies LegalVersionSummary[]
  };
}

export async function fetchLegalAcceptances(admin: SupabaseClient, filters: LegalAdminFilters, limit = 200) {
  let allowedUserIds: string[] | null = null;
  if (filters.userEmail) {
    const { data: users, error: usersError } = await admin
      .from("user_profiles")
      .select("id")
      .ilike("email", `%${filters.userEmail}%`)
      .limit(100)
      .returns<Array<{ id: string }>>();

    if (usersError) {
      throw new Error(usersError.message);
    }

    allowedUserIds = (users ?? []).map((user) => user.id);
    if (allowedUserIds.length === 0) {
      return [];
    }
  }

  let allowedStoreId: string | null = null;
  if (filters.storeSlug) {
    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id")
      .eq("slug", filters.storeSlug)
      .maybeSingle<{ id: string }>();
    if (storeError) {
      throw new Error(storeError.message);
    }
    if (!store?.id) {
      return [];
    }
    allowedStoreId = store.id;
  }

  let documentIds: string[] | null = null;
  if (filters.documentKey) {
    const { data: matchingDocs, error: documentError } = await admin
      .from("legal_documents")
      .select("id")
      .eq("key", filters.documentKey)
      .returns<Array<{ id: string }>>();
    if (documentError) {
      throw new Error(documentError.message);
    }
    documentIds = (matchingDocs ?? []).map((row) => row.id);
    if (documentIds.length === 0) {
      return [];
    }
  }

  let versionQuery = admin.from("legal_document_versions").select("id").limit(500);
  if (documentIds) {
    versionQuery = versionQuery.in("legal_document_id", documentIds);
  }
  if (filters.versionLabel) {
    versionQuery = versionQuery.ilike("version_label", `%${filters.versionLabel}%`);
  }

  const { data: versionRows, error: versionError } = await versionQuery.returns<Array<{ id: string }>>();
  if (versionError) {
    throw new Error(versionError.message);
  }
  const allowedVersionIds = (versionRows ?? []).map((row) => row.id);
  if (allowedVersionIds.length === 0) {
    return [];
  }

  let acceptanceQuery = admin
    .from("legal_acceptances")
    .select("id,accepted_at,acceptance_surface,user_id,store_id,legal_document_versions(version_label,legal_documents(key,title))")
    .in("legal_document_version_id", allowedVersionIds);

  if (allowedUserIds) {
    acceptanceQuery = acceptanceQuery.in("user_id", allowedUserIds);
  }
  if (allowedStoreId) {
    acceptanceQuery = acceptanceQuery.eq("store_id", allowedStoreId);
  }

  const { data: acceptances, error: acceptancesError } = await acceptanceQuery
    .order("accepted_at", { ascending: false })
    .limit(limit)
    .returns<LegalAcceptanceRow[]>();
  if (acceptancesError) {
    throw new Error(acceptancesError.message);
  }

  const userIds = Array.from(new Set((acceptances ?? []).map((row) => row.user_id)));
  const storeIds = Array.from(new Set((acceptances ?? []).map((row) => row.store_id).filter(Boolean) as string[]));

  const [{ data: users }, { data: stores }] = await Promise.all([
    userIds.length
      ? admin.from("user_profiles").select("id,email").in("id", userIds).returns<Array<{ id: string; email: string | null }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null }> }),
    storeIds.length
      ? admin.from("stores").select("id,slug").in("id", storeIds).returns<Array<{ id: string; slug: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string }> })
  ]);

  const userEmailById = new Map((users ?? []).map((user) => [user.id, user.email]));
  const storeSlugById = new Map((stores ?? []).map((store) => [store.id, store.slug]));

  return (acceptances ?? []).map((row) => ({
    id: row.id,
    acceptedAt: row.accepted_at,
    acceptanceSurface: row.acceptance_surface,
    userId: row.user_id,
    userEmail: userEmailById.get(row.user_id) ?? null,
    storeId: row.store_id,
    storeSlug: row.store_id ? (storeSlugById.get(row.store_id) ?? null) : null,
    documentKey: row.legal_document_versions?.legal_documents?.key ?? "unknown",
    documentTitle: row.legal_document_versions?.legal_documents?.title ?? "Legal Document",
    versionLabel: row.legal_document_versions?.version_label ?? "unknown"
  })) satisfies LegalAcceptanceSummary[];
}
