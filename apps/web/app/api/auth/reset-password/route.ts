import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = resetPasswordSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload.", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Password reset session has expired. Request a new reset email." }, { status: 401 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: payload.data.password });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    message: "Password reset complete. Sign in with your new password."
  });
}
