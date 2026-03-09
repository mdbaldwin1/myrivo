import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  versionIds: z.array(z.string().uuid()).min(1).max(20),
  returnTo: z.string().optional()
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return fail(401, "Authentication required.");
  }

  const parsed = await parseJsonRequest(request, payloadSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const distinctIds = Array.from(new Set(parsed.data.versionIds));
  const { data: requiredVersions, error: requiredError } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id")
    .in("id", distinctIds)
    .eq("status", "published")
    .eq("is_required", true);

  if (requiredError) {
    return fail(500, requiredError.message);
  }

  const requiredById = new Map((requiredVersions ?? []).map((row) => [row.id, row]));
  const missingIds = distinctIds.filter((id) => !requiredById.has(id));
  if (missingIds.length > 0) {
    return fail(400, "Some consent targets are invalid or not currently required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("legal_acceptances")
    .select("legal_document_version_id")
    .eq("user_id", user.id)
    .in("legal_document_version_id", distinctIds);

  if (existingError) {
    return fail(500, existingError.message);
  }

  const existingIds = new Set((existing ?? []).map((row) => row.legal_document_version_id));
  const insertRows = distinctIds
    .filter((id) => !existingIds.has(id))
    .map((id) => {
      const version = requiredById.get(id);
      if (!version) {
        throw new Error(`Missing required version ${id}`);
      }
      return {
        legal_document_id: version.legal_document_id,
        legal_document_version_id: id,
        user_id: user.id,
        acceptance_surface: "login_gate"
      };
    });

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase.from("legal_acceptances").insert(insertRows);
    if (insertError) {
      return fail(500, insertError.message);
    }
  }

  const safeReturnTo = sanitizeReturnTo(parsed.data.returnTo ?? null, "/dashboard");
  return NextResponse.json({ ok: true, returnTo: safeReturnTo });
}
