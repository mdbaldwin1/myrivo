import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { buildLegalAcceptancesCsv, fetchLegalAcceptances, parseLegalAdminFilters } from "@/lib/platform/legal-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  try {
    const admin = createSupabaseAdminClient();
    const filters = parseLegalAdminFilters(new URL(request.url).searchParams);
    const rows = await fetchLegalAcceptances(admin, filters, 2000);
    const csv = buildLegalAcceptancesCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="legal-acceptances-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export legal acceptances.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
