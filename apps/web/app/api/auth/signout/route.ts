import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
