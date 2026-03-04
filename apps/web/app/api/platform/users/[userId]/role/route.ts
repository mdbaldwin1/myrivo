import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  globalRole: z.enum(["user", "support", "admin"])
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const payload = payloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { userId } = await params;
  const admin = createSupabaseAdminClient();

  if (auth.context?.userId === userId && payload.data.globalRole !== "admin") {
    const { count, error: countError } = await admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("global_role", "admin");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "At least one platform admin is required." }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .from("user_profiles")
    .update({ global_role: payload.data.globalRole })
    .eq("id", userId)
    .select("id,email,display_name,global_role,created_at")
    .maybeSingle<{
      id: string;
      email: string | null;
      display_name: string | null;
      global_role: "user" | "support" | "admin";
      created_at: string;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

