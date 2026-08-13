import { NextRequest, NextResponse } from "next/server";
import {
  attachDigitalDownloadSession,
  authorizeAccessToken,
  DigitalDownloadError,
  enforceDigitalDownloadRateLimit,
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
  try {
    await enforceDigitalDownloadRateLimit({ request, action: "list", client });
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
