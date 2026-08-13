import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExternalAppUrl, getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import { hashDigitalAccessToken } from "./entitlements";

const RECOVERY_SESSION_COOKIE = "myrivo_recovery_session";
const RECOVERY_SESSION_COOKIE_PATTERN =
  /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type CustomerDigitalAccessRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
};

export type DigitalRecoverySession = {
  cookieValue: string;
  isNew: boolean;
  clientIpSubjectHash: string;
  clientSubjectHash: string;
  pairSubjectHash: string;
};

export type DigitalAccessRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: false; unavailable: true };

const recoveryResultSchema = z.object({
  queued: z.boolean(),
  notification_id: z.string().uuid().nullable().optional(),
});

const directAccessResultSchema = z.object({
  available: z.boolean(),
  access_token_id: z.string().uuid().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

function unwrapRpcRow(data: unknown) {
  return Array.isArray(data) ? data[0] : data;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function recoverySessionSignature(id: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`digital-recovery-session-cookie-v1\0${id}`)
    .digest("base64url");
}

function verifyRecoverySession(candidate: string | undefined, secret: string) {
  const match = candidate?.match(RECOVERY_SESSION_COOKIE_PATTERN);
  const id = match?.[1];
  const signature = match?.[2];
  if (!id || !signature) return null;
  const presented = Buffer.from(signature, "base64url");
  const expected = Buffer.from(recoverySessionSignature(id, secret), "base64url");
  return presented.length === expected.length && timingSafeEqual(presented, expected)
    ? id
    : null;
}

function keyedSubjectHash(secret: string, domain: string, value: string) {
  return createHmac("sha256", secret)
    .update(`${domain}\0${value}`)
    .digest("hex");
}

export function resolveDigitalRecoveryClientIpSubjectHash(
  request: NextRequest,
): string {
  const environment = getServerEnv();
  const secret = environment.DIGITAL_DOWNLOAD_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Digital recovery session configuration is unavailable");
  }
  const configuredHeader = environment.DIGITAL_RECOVERY_TRUSTED_IP_HEADER
    ?.trim()
    .toLowerCase();
  const headerName = process.env.VERCEL === "1"
    ? "x-vercel-forwarded-for"
    : configuredHeader;
  if (
    !headerName ||
    headerName === "forwarded" ||
    headerName === "x-forwarded-for"
  ) {
    throw new Error("Trusted client identity is unavailable");
  }
  const candidate = request.headers.get(headerName)?.trim().toLowerCase();
  if (!candidate || candidate.includes(",") || isIP(candidate) === 0) {
    throw new Error("Trusted client identity is unavailable");
  }
  return keyedSubjectHash(secret, "digital-recovery-client-ip-v1", candidate);
}

export function getDigitalRecoveryResponseTargetMs(
  clientIpSubjectHash: string,
): number {
  if (!SHA_256_PATTERN.test(clientIpSubjectHash)) {
    throw new Error("Digital recovery response identity is invalid");
  }
  const secret = getServerEnv().DIGITAL_DOWNLOAD_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Digital recovery session configuration is unavailable");
  }
  const digest = createHmac("sha256", secret)
    .update(`digital-recovery-response-envelope-v1\0${clientIpSubjectHash}`)
    .digest();
  const jitter = (digest[0] ?? 0) % DIGITAL_PRODUCT_CONFIG.recoveryResponseJitterQuanta;
  return (
    DIGITAL_PRODUCT_CONFIG.recoveryResponseBaseMs +
    jitter * DIGITAL_PRODUCT_CONFIG.recoveryResponseQuantumMs
  );
}

export async function runCustomerRecoveryWithinTimeout(
  operation: () => Promise<unknown>,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(
      () => resolve(false),
      DIGITAL_PRODUCT_CONFIG.recoveryWorkTimeoutMs,
    );
  });
  try {
    return await Promise.race([
      operation().then(() => true, () => false),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getDigitalRecoverySession(
  request: NextRequest,
  orderId: string,
  email: string,
): DigitalRecoverySession {
  const secret = getServerEnv().DIGITAL_DOWNLOAD_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Digital recovery session configuration is unavailable");
  }
  const existingId = verifyRecoverySession(
    request.cookies.get(RECOVERY_SESSION_COOKIE)?.value,
    secret,
  );
  const id = existingId ?? randomUUID();
  return {
    cookieValue: `v1.${id}.${recoverySessionSignature(id, secret)}`,
    isNew: existingId === null,
    clientIpSubjectHash: resolveDigitalRecoveryClientIpSubjectHash(request),
    clientSubjectHash: keyedSubjectHash(
      secret,
      "digital-recovery-client-v1",
      id,
    ),
    pairSubjectHash: keyedSubjectHash(
      secret,
      "digital-recovery-pair-v1",
      `${orderId}\0${normalizeEmail(email)}`,
    ),
  };
}

export function attachDigitalRecoverySession<T extends NextResponse>(
  response: T,
  session: DigitalRecoverySession,
): T {
  if (!session.isNew) return response;
  response.cookies.set(RECOVERY_SESSION_COOKIE, session.cookieValue, {
    httpOnly: true,
    maxAge: DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

async function checkDistributedRateLimit(
  client: CustomerDigitalAccessRpcClient,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<DigitalAccessRateLimitResult> {
  if (!SHA_256_PATTERN.test(bucketKey)) return { allowed: false, unavailable: true };
  try {
    const result = await client.rpc("check_api_rate_limit", {
      p_bucket_key: `digital-access:${bucketKey}`,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (result.error) return { allowed: false, unavailable: true };
    const row = unwrapRpcRow(result.data) as {
      allowed?: unknown;
      retry_after_seconds?: unknown;
    } | null;
    if (!row || typeof row.allowed !== "boolean") {
      return { allowed: false, unavailable: true };
    }
    if (row.allowed) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds:
        typeof row.retry_after_seconds === "number" &&
        Number.isInteger(row.retry_after_seconds) &&
        row.retry_after_seconds > 0
          ? row.retry_after_seconds
          : 1,
    };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

export async function enforceDigitalRecoveryRateLimits(
  input: {
    clientIpSubjectHash: string;
    clientSubjectHash: string;
    pairSubjectHash: string;
  },
  client: CustomerDigitalAccessRpcClient = createSupabaseAdminClient(),
): Promise<DigitalAccessRateLimitResult> {
  const windowMs = 60 * 60 * 1000;
  const clientIpResult = await checkDistributedRateLimit(
    client,
    createHash("sha256")
      .update(`digital-recovery-client-ip-rate-v1\0${input.clientIpSubjectHash}`)
      .digest("hex"),
    DIGITAL_PRODUCT_CONFIG.recoveryClientRateLimitPerHour,
    windowMs,
  );
  if (!clientIpResult.allowed) return clientIpResult;
  const clientResult = await checkDistributedRateLimit(
    client,
    createHash("sha256")
      .update(`digital-recovery-session-rate-v1\0${input.clientSubjectHash}`)
      .digest("hex"),
    DIGITAL_PRODUCT_CONFIG.recoveryClientRateLimitPerHour,
    windowMs,
  );
  if (!clientResult.allowed) return clientResult;
  return checkDistributedRateLimit(
    client,
    createHash("sha256")
      .update(`digital-recovery-pair-rate-v1\0${input.pairSubjectHash}`)
      .digest("hex"),
    DIGITAL_PRODUCT_CONFIG.recoveryPairRateLimitPerHour,
    windowMs,
  );
}

export async function enforceAuthenticatedDigitalAccessRateLimits(
  input: { userId: string; orderId: string },
  client: CustomerDigitalAccessRpcClient = createSupabaseAdminClient(),
): Promise<DigitalAccessRateLimitResult> {
  const subject = createHash("sha256")
    .update(`authenticated-digital-access-v1\0${input.userId}\0${input.orderId}`)
    .digest("hex");
  return checkDistributedRateLimit(
    client,
    subject,
    DIGITAL_PRODUCT_CONFIG.authenticatedAccessRateLimitPerMinute,
    60_000,
  );
}

export function deriveCustomerRecoveryAccessToken(input: {
  notificationId: string;
  nonce: string;
  secret: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`customer-recovery-v1:${input.notificationId}:${input.nonce}`)
    .digest("base64url");
}

function safeRecoveryFailure(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (
    /authorization|bearer|downloads\/|@|secret|api[_ -]?key|digital-product-assets|private\//i.test(
      raw,
    )
  ) {
    return "Digital access recovery failed";
  }
  const bounded = raw.trim().slice(0, 200);
  return bounded || "Digital access recovery failed";
}

async function recordRecoveryFailure(
  client: CustomerDigitalAccessRpcClient,
  requestPairHash: string,
  error: unknown,
) {
  try {
    await client.rpc("record_customer_digital_access_recovery_failure", {
      p_request_pair_hash: requestPairHash,
      p_safe_error: safeRecoveryFailure(error),
    });
  } catch {
    // A completely unavailable database cannot persist its own outage.
  }
}

export async function queueCustomerDigitalAccessRecovery({
  orderId,
  email,
  tokenSecret,
  client = createSupabaseAdminClient(),
}: {
  orderId: string;
  email: string;
  tokenSecret: string;
  client?: CustomerDigitalAccessRpcClient;
}): Promise<{ queued: boolean }> {
  const parsed = z
    .object({
      orderId: z.string().uuid(),
      email: z.string().trim().email().max(254),
      tokenSecret: z.string().trim().min(32),
    })
    .parse({ orderId, email: normalizeEmail(email), tokenSecret });
  const notificationId = randomUUID();
  const accessTokenId = randomUUID();
  const nonce = randomUUID();
  const requestPairHash = keyedSubjectHash(
    parsed.tokenSecret,
    "digital-recovery-request-pair-v1",
    `${parsed.orderId}\0${parsed.email}`,
  );
  const accessToken = deriveCustomerRecoveryAccessToken({
    notificationId,
    nonce,
    secret: parsed.tokenSecret,
  });
  try {
    const result = await client.rpc(
      "prepare_customer_digital_access_recovery",
      {
        p_order_id: parsed.orderId,
        p_customer_email: parsed.email,
        p_request_pair_hash: requestPairHash,
        p_notification_id: notificationId,
        p_access_token_id: accessTokenId,
        p_token_derivation_nonce: nonce,
        p_token_hash: hashDigitalAccessToken(accessToken),
        p_access_ttl_seconds:
          DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60,
      },
    );
    if (result.error) {
      await recordRecoveryFailure(client, requestPairHash, result.error.message);
      return { queued: false };
    }
    const parsedResult = recoveryResultSchema.safeParse(unwrapRpcRow(result.data));
    if (!parsedResult.success) {
      await recordRecoveryFailure(
        client,
        requestPairHash,
        "Digital access recovery returned an invalid result",
      );
      return { queued: false };
    }
    return { queued: parsedResult.data.queued };
  } catch (error) {
    await recordRecoveryFailure(client, requestPairHash, error);
    return { queued: false };
  }
}

export async function issueAuthenticatedCustomerDigitalAccess({
  orderId,
  actorUserId,
  email,
  client = createSupabaseAdminClient(),
  externalAppUrl = getExternalAppUrl(),
  createAccessToken = () => randomBytes(32).toString("base64url"),
}: {
  orderId: string;
  actorUserId: string;
  email: string;
  client?: CustomerDigitalAccessRpcClient;
  externalAppUrl?: string;
  createAccessToken?: () => string;
}): Promise<{ accessUrl: string; expiresAt: string } | null> {
  const parsed = z
    .object({
      orderId: z.string().uuid(),
      actorUserId: z.string().uuid(),
      email: z.string().trim().email().max(254),
    })
    .parse({ orderId, actorUserId, email: normalizeEmail(email) });
  const accessToken = z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .parse(createAccessToken());
  const accessTokenId = randomUUID();
  const result = await client.rpc(
    "issue_authenticated_customer_digital_access",
    {
      p_order_id: parsed.orderId,
      p_actor_user_id: parsed.actorUserId,
      p_customer_email: parsed.email,
      p_access_token_id: accessTokenId,
      p_token_hash: hashDigitalAccessToken(accessToken),
      p_access_ttl_seconds:
        DIGITAL_PRODUCT_CONFIG.authenticatedAccessTtlMinutes * 60,
    },
  );
  if (result.error) {
    throw new Error("Digital customer access could not be issued");
  }
  const parsedResult = directAccessResultSchema.safeParse(
    unwrapRpcRow(result.data),
  );
  if (!parsedResult.success) {
    throw new Error("Digital customer access returned an invalid result");
  }
  if (!parsedResult.data.available) return null;
  if (
    parsedResult.data.access_token_id !== accessTokenId ||
    !parsedResult.data.expires_at
  ) {
    throw new Error("Digital customer access returned an invalid result");
  }
  return {
    accessUrl: `${externalAppUrl.replace(/\/$/, "")}/downloads/${accessToken}`,
    expiresAt: parsedResult.data.expires_at,
  };
}
