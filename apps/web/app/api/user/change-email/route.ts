import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const changeEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  currentPassword: z.string().min(1, "Enter your current password.")
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = changeEmailSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload.", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "Current account email is unavailable." }, { status: 400 });
  }

  const nextEmail = payload.data.email.toLowerCase();
  if (nextEmail === user.email.toLowerCase()) {
    return NextResponse.json({ error: "Use a different email address." }, { status: 400 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: payload.data.currentPassword
  });

  if (signInError) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Email change requested. Check your inbox for the confirmation link before the new address becomes active."
  });
}
