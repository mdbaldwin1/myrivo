import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  attachDigitalDownloadSession,
  authorizeAccessToken,
  DigitalDownloadError,
  enforceDigitalDownloadExchangeRateLimit,
  getDigitalDownloadSession,
  hardenDigitalDownloadResponse,
} from "@/lib/digital-products/download-service";
import { resolveDigitalRecoveryClientIpSubjectHash } from "@/lib/digital-products/customer-access";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;
  let clientIpSubjectHash: string;
  try {
    clientIpSubjectHash = resolveDigitalRecoveryClientIpSubjectHash(request);
  } catch {
    return hardenDigitalDownloadResponse(NextResponse.json({ error: "Download service is temporarily unavailable." }, { status: 503 }));
  }
  const client = createSupabaseAdminClient();
  try {
    await enforceDigitalDownloadExchangeRateLimit({ rateLimitSubjectHash: clientIpSubjectHash, client: client as never });
    const access = await authorizeAccessToken({ token: parsed.data.token, client: client as never });
    if (!access) return hardenDigitalDownloadResponse(NextResponse.json({ error: "This access link is unavailable." }, { status: 410 }));
    const session = getDigitalDownloadSession(request, parsed.data.token, access.access_token_id);
    return attachDigitalDownloadSession(
      hardenDigitalDownloadResponse(NextResponse.json({ ok: true }, { status: 201 })),
      session,
    );
  } catch (error) {
    if (error instanceof DigitalDownloadError && error.code === "rate_limited") {
      return hardenDigitalDownloadResponse(NextResponse.json(
        { error: "Too many requests. Please retry shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds ?? 1) } },
      ));
    }
    return hardenDigitalDownloadResponse(NextResponse.json({ error: "Download service is temporarily unavailable." }, { status: 503 }));
  }
}
