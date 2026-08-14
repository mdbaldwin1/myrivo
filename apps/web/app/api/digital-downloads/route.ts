import { NextRequest, NextResponse } from "next/server";
import {
  attachDigitalDownloadSession,
  authorizeAccessTokenId,
  DigitalDownloadError,
  enforceDigitalDownloadRateLimits,
  getEstablishedDigitalDownloadSession,
  hardenDigitalDownloadResponse,
  listAuthorizedDigitalDownloads,
  type DigitalDownloadClient,
} from "@/lib/digital-products/download-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function response(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return hardenDigitalDownloadResponse(NextResponse.json(body, { status, headers }));
}

export async function GET(request: NextRequest) {
  let session;
  try { session = getEstablishedDigitalDownloadSession(request); } catch { return response({ error: "Download service is temporarily unavailable." }, 503); }
  if (!session) return response({ error: "This access link is unavailable." }, 401);
  const client = createSupabaseAdminClient() as unknown as DigitalDownloadClient;
  try {
    await enforceDigitalDownloadRateLimits({ ...session, action: "list", client });
    const access = await authorizeAccessTokenId({ accessTokenId: session.accessTokenId, client });
    if (!access) return response({ error: "This access link is unavailable." }, 410);
    const files = await listAuthorizedDigitalDownloads({ accessTokenId: access.access_token_id, client });
    return attachDigitalDownloadSession(response({
      expiresAt: access.expires_at,
      context: {
        store: { name: access.store_name, slug: access.store_slug, policiesHref: `/s/${encodeURIComponent(access.store_slug)}/policies` },
        license: { version: access.license_version, summary: "Personal printing and gifts only; no resale, sharing, or commercial use.", href: "/legal/digital-personal-use-license" },
      }, files,
    }, 200), { cookieValue: "", isNew: false });
  } catch (error) {
    if (error instanceof DigitalDownloadError && error.code === "rate_limited") return response({ error: "Too many requests. Please retry shortly." }, 429, { "Retry-After": String(error.retryAfterSeconds ?? 1) });
    return response({ error: "Download service is temporarily unavailable." }, 503);
  }
}
