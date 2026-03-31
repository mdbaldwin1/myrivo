import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FUNCTION_SAFE_IMAGE_UPLOAD_MAX_BYTES, FUNCTION_SAFE_IMAGE_UPLOAD_MAX_LABEL } from "@/lib/uploads/image-upload-limits";

const BUCKET = "store-experience";
const MAX_FILE_SIZE_BYTES = FUNCTION_SAFE_IMAGE_UPLOAD_MAX_BYTES;
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
    fileSizeLimit: FUNCTION_SAFE_IMAGE_UPLOAD_MAX_LABEL,
    allowedMimeTypes: [...ALLOWED_MIME]
  });

  if (createBucketError && !String(createBucketError.message).toLowerCase().includes("already exists")) {
    throw new Error(createBucketError.message);
  }
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

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "about").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPEG, WEBP, or SVG." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `Image must be ${FUNCTION_SAFE_IMAGE_UPLOAD_MAX_LABEL} or smaller.` }, { status: 400 });
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
  const safeFolder = folder.toLowerCase().replace(/[^a-z0-9/_-]/g, "") || "about";
  const path = `${bundle.store.id}/${safeFolder}/${Date.now()}-${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600"
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const imageUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ imageUrl }, { status: 201 });
}
