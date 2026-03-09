import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "store-branding";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]);
const ASSET_COLUMN_BY_TYPE = {
  logo: "logo_path",
  favicon: "favicon_path",
  apple_touch_icon: "apple_touch_icon_path",
  og_image: "og_image_path",
  twitter_image: "twitter_image_path"
} as const;
type AssetType = keyof typeof ASSET_COLUMN_BY_TYPE;

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return "ico";
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
  const rawAssetType = formData.get("assetType");
  const assetType = (typeof rawAssetType === "string" && rawAssetType in ASSET_COLUMN_BY_TYPE ? rawAssetType : "logo") as AssetType;
  const targetColumn = ASSET_COLUMN_BY_TYPE[assetType];

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPEG, WEBP, SVG, or ICO." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Asset must be 2MB or smaller." }, { status: 400 });
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
  const path = `${bundle.store.id}/${assetType}-${Date.now()}-${randomUUID()}.${ext}`;

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

  const { data: branding, error: brandingError } = await admin
    .from("store_branding")
    .upsert({ store_id: bundle.store.id, [targetColumn]: publicUrl }, { onConflict: "store_id" })
    .select("store_id,logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path,primary_color,accent_color,theme_json")
    .single();

  if (brandingError) {
    return NextResponse.json({ error: brandingError.message }, { status: 500 });
  }

  return NextResponse.json({
    logoPath: assetType === "logo" ? publicUrl : undefined,
    assetType,
    assetPath: publicUrl,
    branding
  });
}
