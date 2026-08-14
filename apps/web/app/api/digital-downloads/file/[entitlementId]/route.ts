import { NextRequest, NextResponse } from "next/server";
import {
  authorizeAccessTokenId, DigitalDownloadError, enforceDigitalDownloadRateLimits,
  getEstablishedDigitalDownloadSession, hardenDigitalDownloadResponse,
  isValidDigitalEntitlementId, prepareDigitalDownload, type DigitalDownloadClient,
} from "@/lib/digital-products/download-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";

type RouteContext = { params: Promise<{ entitlementId: string }> };
const response = (error: string, status: number) => hardenDigitalDownloadResponse(NextResponse.json({ error }, { status }));
const downloadLimitResponse = () => {
  const contract = DIGITAL_PRODUCT_CONFIG.downloadLimitResponse;
  return hardenDigitalDownloadResponse(NextResponse.json({ code: contract.code, error: contract.message }, { status: contract.status }));
};

export async function POST(request: NextRequest, context: RouteContext) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const { entitlementId } = await context.params;
  let session;
  try { session = getEstablishedDigitalDownloadSession(request); } catch { return response("Download service is temporarily unavailable.", 503); }
  if (!session || !isValidDigitalEntitlementId(entitlementId)) return response("Download unavailable.", 404);
  const client = createSupabaseAdminClient() as unknown as DigitalDownloadClient;
  try {
    await enforceDigitalDownloadRateLimits({ ...session, action: "grant", client });
    const access = await authorizeAccessTokenId({ accessTokenId: session.accessTokenId, client });
    if (!access) return response("This access link is unavailable.", 410);
    const signedUrl = await prepareDigitalDownload({ entitlementId, accessTokenId: access.access_token_id, clientFingerprintHash: session.fingerprintHash, client });
    return hardenDigitalDownloadResponse(NextResponse.redirect(signedUrl, 303));
  } catch (error) {
    if (error instanceof DigitalDownloadError && error.code === "rate_limited") return hardenDigitalDownloadResponse(NextResponse.json({ error: "Too many requests. Please retry shortly." }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds ?? 1) } }));
    if (error instanceof DigitalDownloadError && error.code === "commit_failed") return response("Unable to finalize download.", 409);
    if (error instanceof DigitalDownloadError && error.code === "download_limit_reached") return downloadLimitResponse();
    if (error instanceof DigitalDownloadError && error.code === "download_unavailable") return response("Download unavailable.", 409);
    return response("Unable to prepare download.", 503);
  }
}
