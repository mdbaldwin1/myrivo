import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

const preferencesSchema = z.object({
  weeklyDigestEmails: z.boolean(),
  productAnnouncements: z.boolean()
});

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    preferences: preferencesSchema.optional()
  })
  .refine((value) => value.displayName !== undefined || value.preferences !== undefined, {
    message: "At least one field must be provided."
  });

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  global_role: GlobalUserRole;
  metadata: Record<string, unknown>;
};

function extractPreferences(metadata: Record<string, unknown> | null | undefined) {
  const raw = metadata?.account_preferences;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      weeklyDigestEmails: true,
      productAnnouncements: true
    };
  }

  const preferences = raw as Record<string, unknown>;
  return {
    weeklyDigestEmails: preferences.weeklyDigestEmails !== false,
    productAnnouncements: preferences.productAnnouncements !== false
  };
}

function buildResponse(profile: ProfileRow) {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    globalRole: profile.global_role,
    preferences: extractPreferences(profile.metadata)
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,email,display_name,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile: buildResponse(data) });
}

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

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("user_profiles")
    .select("id,email,display_name,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (currentProfileError) {
    return NextResponse.json({ error: currentProfileError.message }, { status: 500 });
  }

  if (!currentProfile) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  const updates: {
    display_name?: string;
    metadata?: Record<string, unknown>;
  } = {};

  if (payload.data.displayName !== undefined) {
    updates.display_name = payload.data.displayName;
  }

  if (payload.data.preferences !== undefined) {
    const baseMetadata =
      currentProfile.metadata && typeof currentProfile.metadata === "object" && !Array.isArray(currentProfile.metadata)
        ? currentProfile.metadata
        : {};
    updates.metadata = {
      ...baseMetadata,
      account_preferences: payload.data.preferences
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id,email,display_name,global_role,metadata")
    .single<ProfileRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: buildResponse(data) });
}
