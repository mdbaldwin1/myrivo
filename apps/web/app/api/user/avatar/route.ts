import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "user-avatars";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

async function ensureBucket() {
  const admin = createSupabaseAdminClient();
  const { data: bucket, error: getBucketError } = await admin.storage.getBucket(BUCKET);

  if (bucket) {
    return;
  }

  if (getBucketError && !String(getBucketError.message).toLowerCase().includes("not found")) {
    throw new Error(getBucketError.message);
  }

  const { error: createBucketError } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: [...ALLOWED_MIME]
  });

  if (createBucketError && !String(createBucketError.message).toLowerCase().includes("already exists")) {
    throw new Error(createBucketError.message);
  }
}

function toStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const storagePath = publicUrl.slice(markerIndex + marker.length);
  return storagePath || null;
}

function matchesUserPath(publicUrl: string, userId: string): boolean {
  const storagePath = toStoragePath(publicUrl);
  return storagePath !== null && storagePath.startsWith(`${userId}/`);
}

export async function POST(request: NextRequest) {
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPEG, WEBP, or SVG." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Avatar must be 2MB or smaller." }, { status: 400 });
  }

  try {
    await ensureBucket();
  } catch (bucketError) {
    return NextResponse.json(
      { error: bucketError instanceof Error ? bucketError.message : "Unable to initialize storage bucket." },
      { status: 500 }
    );
  }

  const admin = createSupabaseAdminClient();
  const ext = extensionForMime(file.type);
  const path = `${user.id}/avatar-${Date.now()}-${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600"
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ avatarPath: publicUrl });
}

export async function DELETE(request: NextRequest) {
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
  const { data: profile, error: profileLookupError } = await admin
    .from("user_profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle<{ avatar_path: string | null }>();

  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message }, { status: 500 });
  }

  let payload: { avatarPath?: string; clearProfile?: boolean } | null = null;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    try {
      const raw = (await request.json()) as unknown;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const typed = raw as Record<string, unknown>;
        payload = {
          avatarPath: typeof typed.avatarPath === "string" ? typed.avatarPath : undefined,
          clearProfile: typeof typed.clearProfile === "boolean" ? typed.clearProfile : undefined
        };
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
  }

  const requestedPath = payload?.avatarPath?.trim();
  const persistedPath = profile?.avatar_path?.trim() ?? "";
  const avatarPath = requestedPath || persistedPath;

  if (!avatarPath) {
    return NextResponse.json({ ok: true, avatarPath: profile?.avatar_path ?? null });
  }

  if (!matchesUserPath(avatarPath, user.id)) {
    return NextResponse.json({ error: "Invalid avatar path." }, { status: 400 });
  }

  const storageObjectPath = toStoragePath(avatarPath);
  if (storageObjectPath) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove([storageObjectPath]);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  const shouldClearProfile =
    requestedPath === undefined || (payload?.clearProfile === true && persistedPath !== "" && persistedPath === avatarPath);

  if (shouldClearProfile) {
    const { error: profileError } = await admin.from("user_profiles").update({ avatar_path: null }).eq("id", user.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, avatarPath: null });
  }

  return NextResponse.json({ ok: true, avatarPath: profile?.avatar_path ?? null });
}
