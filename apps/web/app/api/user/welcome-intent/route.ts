import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/http/read-json-body";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withWelcomeIntent, type WelcomeIntent } from "@/lib/auth/welcome-intent";
import type { GlobalUserRole } from "@/types/database";

const payloadSchema = z.object({
  intent: z.enum(["shop", "sell"])
});

type ProfileRow = {
  id: string;
  email: string | null;
  global_role: GlobalUserRole;
  metadata: Record<string, unknown> | null;
};

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody.response;
  }

  const payload = payloadSchema.safeParse(rawBody.data);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: currentProfile, error: currentProfileError } = await admin
    .from("user_profiles")
    .select("id,email,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (currentProfileError) {
    return NextResponse.json({ error: currentProfileError.message }, { status: 500 });
  }

  const updates: {
    id: string;
    email?: string | null;
    global_role?: GlobalUserRole;
    metadata: Record<string, unknown>;
  } = {
    id: user.id,
    metadata: withWelcomeIntent(currentProfile?.metadata, payload.data.intent as WelcomeIntent)
  };

  if (!currentProfile) {
    updates.email = user.email ?? null;
    updates.global_role = "user";
  }

  const { error } = await admin.from("user_profiles").upsert(updates, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, intent: payload.data.intent });
}
