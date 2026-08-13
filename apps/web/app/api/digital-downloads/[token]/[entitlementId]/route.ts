import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DIGITAL_ASSET_BUCKET } from "@/lib/digital-products/assets";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string; entitlementId: string }> }) {
  const { token, entitlementId } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: access } = await admin.from("digital_order_access_tokens").select("id,order_id,expires_at,revoked_at").eq("token_hash", hashDigitalAccessToken(token)).maybeSingle();
  if (!access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This access link is invalid or expired." }, { status: 410 });
  const { data: entitlement } = await admin.from("digital_order_entitlements").select("id").eq("id", entitlementId).eq("order_id", access.order_id).maybeSingle();
  if (!entitlement) return NextResponse.json({ error: "Download unavailable." }, { status: 404 });

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientFingerprintHash = createHash("sha256")
    .update([
      access.id,
      forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown-ip",
      request.headers.get("user-agent")?.trim() || "unknown-agent",
    ].join("\0"))
    .digest("hex");
  const { data, error } = await admin.rpc("reserve_digital_download_grant", {
    p_entitlement_id: entitlementId,
    p_access_token_id: access.id,
    p_reservation_key: randomUUID(),
    p_client_fingerprint_hash: clientFingerprintHash,
  });
  const grant = Array.isArray(data) ? data[0] : data;
  if (error || !grant?.grant_id || !grant.asset_version_id || !grant.customer_filename) {
    return NextResponse.json({ error: "Download unavailable." }, { status: 409 });
  }

  const releaseReservation = async (safeError: string) => {
    await admin.rpc("release_digital_download_grant", {
      p_grant_id: grant.grant_id,
      p_client_fingerprint_hash: clientFingerprintHash,
      p_safe_error: safeError,
    });
  };
  let failureStage = "Asset lookup";
  let reservationCommitted = false;

  try {
    const { data: assetVersion, error: assetVersionError } = await admin
      .from("digital_product_asset_versions")
      .select("storage_path")
      .eq("id", grant.asset_version_id)
      .maybeSingle();
    if (assetVersionError || !assetVersion?.storage_path) {
      return NextResponse.json({ error: "Unable to prepare download." }, { status: 500 });
    }

    failureStage = "Storage signing";
    const { data: signed, error: signedError } = await admin.storage.from(DIGITAL_ASSET_BUCKET).createSignedUrl(assetVersion.storage_path, DIGITAL_PRODUCT_CONFIG.signedDownloadTtlSeconds, { download: grant.customer_filename });
    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: "Unable to prepare download." }, { status: 500 });
    }

    failureStage = "Grant commit";
    const { data: commitStatus, error: commitError } = await admin.rpc("commit_digital_download_grant", {
      p_grant_id: grant.grant_id,
      p_client_fingerprint_hash: clientFingerprintHash,
    });
    if (commitError || commitStatus !== "issued") {
      return NextResponse.json({ error: "Unable to finalize download." }, { status: 409 });
    }

    reservationCommitted = true;
    return NextResponse.redirect(signed.signedUrl, 303);
  } catch {
    if (failureStage === "Grant commit") {
      return NextResponse.json({ error: "Unable to finalize download." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to prepare download." }, { status: 500 });
  } finally {
    if (!reservationCommitted) {
      try {
        await releaseReservation(`${failureStage} failed`);
      } catch {
        // Reservation expiry is the final backstop when best-effort cleanup is unavailable.
      }
    }
  }
}
