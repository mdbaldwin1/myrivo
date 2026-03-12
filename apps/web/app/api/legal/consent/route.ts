import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { recordLegalAcceptances } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  versionIds: z.array(z.string().uuid()).min(1).max(20),
  acceptanceSurface: z.enum(["login_gate", "signup"]).optional(),
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

  try {
    await recordLegalAcceptances(supabase, {
      userId: user.id,
      versionIds: parsed.data.versionIds,
      acceptanceSurface: parsed.data.acceptanceSurface ?? "login_gate"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record legal consent.";
    if (message === "Some consent targets are invalid or not currently required.") {
      return fail(400, message);
    }
    return fail(500, message);
  }

  const safeReturnTo = sanitizeReturnTo(parsed.data.returnTo ?? null, "/dashboard");
  return NextResponse.json({ ok: true, returnTo: safeReturnTo });
}
