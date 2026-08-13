import { NextRequest, NextResponse } from "next/server";
import {
  attachDigitalDownloadSession,
  authorizeAccessToken,
  DigitalDownloadError,
  enforceDigitalDownloadRateLimit,
  getDigitalDownloadSession,
  hardenDigitalDownloadResponse,
  isValidDigitalAccessToken,
  isValidDigitalEntitlementId,
  prepareDigitalDownload,
  type DigitalDownloadClient,
} from "@/lib/digital-products/download-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ token: string; entitlementId: string }>;
};

function response(
  body: { error: string },
  status: number,
  headers?: Record<string, string>,
) {
  return hardenDigitalDownloadResponse(
    NextResponse.json(body, { status, headers }),
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { token, entitlementId } = await context.params;
  if (
    !isValidDigitalAccessToken(token) ||
    !isValidDigitalEntitlementId(entitlementId)
  ) {
    return response({ error: "Download unavailable." }, 404);
  }

  const client = createSupabaseAdminClient() as unknown as DigitalDownloadClient;
  try {
    await enforceDigitalDownloadRateLimit({ request, action: "grant", client });
  } catch (error) {
    if (error instanceof DigitalDownloadError && error.code === "rate_limited") {
      return response(
        { error: "Too many requests. Please retry shortly." },
        429,
        { "Retry-After": String(error.retryAfterSeconds ?? 1) },
      );
    }
    return response(
      { error: "Download service is temporarily unavailable." },
      503,
    );
  }

  const session = getDigitalDownloadSession(request);
  let access;
  try {
    access = await authorizeAccessToken({ token, client });
  } catch {
    return attachDigitalDownloadSession(
      response(
        { error: "Download service is temporarily unavailable." },
        503,
      ),
      session,
    );
  }
  if (!access) {
    return attachDigitalDownloadSession(
      response({ error: "This access link is unavailable." }, 410),
      session,
    );
  }

  try {
    const signedUrl = await prepareDigitalDownload({
      entitlementId,
      accessTokenId: access.access_token_id,
      clientFingerprintHash: session.fingerprintHash,
      client,
    });
    return attachDigitalDownloadSession(
      hardenDigitalDownloadResponse(NextResponse.redirect(signedUrl, 303)),
      session,
    );
  } catch (error) {
    if (error instanceof DigitalDownloadError) {
      if (error.code === "download_unavailable") {
        return attachDigitalDownloadSession(
          response({ error: "Download unavailable." }, 409),
          session,
        );
      }
      if (error.code === "commit_failed") {
        return attachDigitalDownloadSession(
          response({ error: "Unable to finalize download." }, 409),
          session,
        );
      }
    }
    return attachDigitalDownloadSession(
      response({ error: "Unable to prepare download." }, 503),
      session,
    );
  }
}
