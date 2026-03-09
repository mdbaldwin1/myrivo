import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/http/read-json-body";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

const preferencesSchema = z.object({
  weeklyDigestEmails: z.boolean().optional(),
  productAnnouncements: z.boolean().optional(),
  notificationSoundEnabled: z.boolean().optional(),
  orderAlertsEmail: z.boolean().optional(),
  orderAlertsInApp: z.boolean().optional(),
  inventoryAlertsEmail: z.boolean().optional(),
  inventoryAlertsInApp: z.boolean().optional(),
  systemAlertsEmail: z.boolean().optional(),
  systemAlertsInApp: z.boolean().optional(),
  teamAlertsEmail: z.boolean().optional(),
  teamAlertsInApp: z.boolean().optional()
});

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    avatarPath: z.string().trim().url().nullable().optional(),
    preferences: preferencesSchema.optional()
  })
  .refine((value) => value.displayName !== undefined || value.avatarPath !== undefined || value.preferences !== undefined, {
    message: "At least one field must be provided."
  });

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  global_role: GlobalUserRole;
  metadata: Record<string, unknown>;
};

const AVATAR_BUCKET = "user-avatars";

function toStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const storagePath = publicUrl.slice(markerIndex + marker.length);
  return storagePath || null;
}

function isValidAvatarUrlForUser(avatarUrl: string, userId: string): boolean {
  const storagePath = toStoragePath(avatarUrl);
  return storagePath !== null && storagePath.startsWith(`${userId}/`);
}

function extractPreferences(metadata: Record<string, unknown> | null | undefined) {
  return resolveAccountNotificationPreferences(metadata);
}

function buildResponse(profile: ProfileRow) {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    avatarPath: profile.avatar_path,
    globalRole: profile.global_role,
    preferences: extractPreferences(profile.metadata)
  };
}

function buildDefaultProfile(user: { id: string; email?: string | null }) {
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: null,
    avatarPath: null,
    globalRole: "user" as const,
    preferences: {
      weeklyDigestEmails: true,
      productAnnouncements: true,
      notificationSoundEnabled: false,
      orderAlertsEmail: true,
      orderAlertsInApp: true,
      inventoryAlertsEmail: true,
      inventoryAlertsInApp: true,
      systemAlertsEmail: true,
      systemAlertsInApp: true,
      teamAlertsEmail: true,
      teamAlertsInApp: true
    }
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
    .select("id,email,display_name,avatar_path,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ profile: buildDefaultProfile(user) });
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
  const admin = createSupabaseAdminClient();

  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody.response;
  }

  const payload = updateSchema.safeParse(rawBody.data);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { data: currentProfile, error: currentProfileError } = await admin
    .from("user_profiles")
    .select("id,email,display_name,avatar_path,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (currentProfileError) {
    return NextResponse.json({ error: currentProfileError.message }, { status: 500 });
  }

  const updates: {
    id: string;
    email?: string | null;
    global_role?: GlobalUserRole;
    display_name?: string;
    avatar_path?: string | null;
    metadata?: Record<string, unknown>;
  } = { id: user.id };

  if (!currentProfile) {
    updates.id = user.id;
    updates.email = user.email ?? null;
    updates.global_role = "user";
  }

  if (payload.data.displayName !== undefined) {
    updates.display_name = payload.data.displayName;
  }

  if (payload.data.preferences !== undefined) {
    const currentMetadata = currentProfile?.metadata;
    const baseMetadata =
      currentMetadata && typeof currentMetadata === "object" && !Array.isArray(currentMetadata)
        ? currentMetadata
        : {};
    const mergedPreferences = {
      ...resolveAccountNotificationPreferences(baseMetadata),
      ...payload.data.preferences
    };
    updates.metadata = {
      ...baseMetadata,
      account_preferences: mergedPreferences
    };
  }

  if (payload.data.avatarPath !== undefined) {
    const nextAvatarPath = payload.data.avatarPath;
    if (nextAvatarPath && !isValidAvatarUrlForUser(nextAvatarPath, user.id)) {
      return NextResponse.json({ error: "Invalid avatar path." }, { status: 400 });
    }
    updates.avatar_path = nextAvatarPath;
  }

  const { data, error } = await admin
    .from("user_profiles")
    .upsert(updates, { onConflict: "id" })
    .select("id,email,display_name,avatar_path,global_role,metadata")
    .single<ProfileRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (payload.data.avatarPath !== undefined && currentProfile?.avatar_path && currentProfile.avatar_path !== data.avatar_path) {
    const previousStoragePath = toStoragePath(currentProfile.avatar_path);
    if (previousStoragePath) {
      await admin.storage.from(AVATAR_BUCKET).remove([previousStoragePath]);
    }
  }

  return NextResponse.json({ ok: true, profile: buildResponse(data) });
}
