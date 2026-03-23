import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { fetchLegalAcceptances, fetchLegalDocumentsAndVersions, parseLegalAdminFilters } from "@/lib/platform/legal-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  try {
    const admin = createSupabaseAdminClient();
    const filters = parseLegalAdminFilters(new URL(request.url).searchParams);
    const [{ documents, versions }, acceptances] = await Promise.all([
      fetchLegalDocumentsAndVersions(admin),
      fetchLegalAcceptances(admin, filters, 200)
    ]);

    return NextResponse.json({
      role: auth.context?.globalRole ?? "user",
      documents,
      versions,
      acceptances
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load legal admin data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
