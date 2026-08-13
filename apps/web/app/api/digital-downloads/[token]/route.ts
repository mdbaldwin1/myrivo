import { NextRequest, NextResponse } from "next/server";
import {
  attachDigitalDownloadSession,
  authorizeAccessToken,
  DigitalDownloadError,
  enforceDigitalDownloadRateLimits,
  getDigitalDownloadSession,
  hardenDigitalDownloadResponse,
  isValidDigitalAccessToken,
  listAuthorizedDigitalDownloads,
  type DigitalDownloadClient,
} from "@/lib/digital-products/download-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ token: string }> };

function response(
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
) {
  return hardenDigitalDownloadResponse(
    NextResponse.json(body, { status, headers }),
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!isValidDigitalAccessToken(token)) {
    return response({ error: "This access link is unavailable." }, 410);
  }

  const client = createSupabaseAdminClient() as unknown as DigitalDownloadClient;
  let session;
  try {
    session = getDigitalDownloadSession(request, token);
  } catch {
    return response(
      { error: "Download service is temporarily unavailable." },
      503,
    );
  }
  try {
    await enforceDigitalDownloadRateLimits({
      bearerRateLimitSubjectHash: session.bearerRateLimitSubjectHash,
      sessionRateLimitSubjectHash: session.sessionRateLimitSubjectHash,
      action: "list",
      client,
    });
  } catch (error) {
    if (error instanceof DigitalDownloadError && error.code === "rate_limited") {
      return attachDigitalDownloadSession(
        response(
          { error: "Too many requests. Please retry shortly." },
          429,
          { "Retry-After": String(error.retryAfterSeconds ?? 1) },
        ),
        session,
      );
    }
    return attachDigitalDownloadSession(
      response(
        { error: "Download service is temporarily unavailable." },
        503,
      ),
      session,
    );
  }

  try {
    const access = await authorizeAccessToken({ token, client });
    if (!access) {
      return attachDigitalDownloadSession(
        response({ error: "This access link is unavailable." }, 410),
        session,
      );
    }
    const files = await listAuthorizedDigitalDownloads({
      accessTokenId: access.access_token_id,
      client,
    });
    return attachDigitalDownloadSession(
      response({ expiresAt: access.expires_at, files }, 200),
      session,
    );
  } catch {
    return attachDigitalDownloadSession(
      response(
        { error: "Download service is temporarily unavailable." },
        503,
      ),
      session,
    );
  }
}
