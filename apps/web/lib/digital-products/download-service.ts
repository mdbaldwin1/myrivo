import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_ASSET_BUCKET } from "./assets";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import { hashDigitalAccessToken } from "./entitlements";
import { recordDigitalProductEventBestEffort } from "./telemetry";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const DOWNLOAD_SESSION_COOKIE = "myrivo_download_session";
const DOWNLOAD_SESSION_COOKIE_PATTERN =
  /^v2\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i;

const accessSchema = z.object({
  access_token_id: z.string().regex(POSTGRES_UUID_PATTERN),
  order_id: z.string().regex(POSTGRES_UUID_PATTERN),
  store_id: z.string().regex(POSTGRES_UUID_PATTERN),
  expires_at: z.string().datetime({ offset: true }),
  store_name: z.string().trim().min(1).max(200),
  store_slug: z.string().trim().min(1).max(200),
  license_version: z.string().trim().min(1).max(100),
});

const listedDownloadSchema = z.object({
  entitlement_id: z.string().regex(POSTGRES_UUID_PATTERN),
  label: z.string().trim().min(1).max(255),
  customer_filename: z.string().trim().min(1).max(255),
  mime_type: z.enum([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/zip",
  ]),
  byte_size: z.number().int().positive(),
  status: z.enum(["active", "suspended", "revoked"]),
  grants_remaining: z.number().int().nonnegative(),
});

const reservationSchema = z.object({
  grant_id: z.string().regex(POSTGRES_UUID_PATTERN),
  store_id: z.string().regex(POSTGRES_UUID_PATTERN),
  product_id: z.string().regex(POSTGRES_UUID_PATTERN),
  asset_id: z.string().regex(POSTGRES_UUID_PATTERN),
  asset_version_id: z.string().regex(POSTGRES_UUID_PATTERN),
  customer_filename: z.string().trim().min(1).max(255),
  grant_status: z.enum(["reserved", "issued"]),
  reservation_expires_at: z.string().datetime({ offset: true }),
});

const storagePathSchema = z.object({
  storage_path: z.string().trim().min(1).max(1024),
});

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

type VersionQuery = {
  eq: (column: string, value: string) => VersionQuery;
  maybeSingle: () => PromiseLike<RpcResult>;
};

export type DigitalDownloadClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  from: (table: string) => {
    select: (columns: string) => VersionQuery;
  };
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
        options: { download: string },
      ) => PromiseLike<{
        data: { signedUrl?: string } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export type AuthorizedDigitalAccess = z.infer<typeof accessSchema>;

export type ListedDigitalDownload = {
  id: string;
  label: string;
  customerFilename: string;
  mimeType: string;
  byteSize: number;
  status: "active" | "suspended" | "revoked";
  grantsRemaining: number;
};

export type DigitalDownloadFailureCode =
  | "rate_limited"
  | "rate_limit_unavailable"
  | "service_unavailable"
  | "access_unavailable"
  | "download_unavailable"
  | "preparation_failed"
  | "commit_failed";

export class DigitalDownloadError extends Error {
  constructor(
    readonly code: DigitalDownloadFailureCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "DigitalDownloadError";
  }
}

function unwrapRpcRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

function defaultClient(): DigitalDownloadClient {
  return createSupabaseAdminClient() as unknown as DigitalDownloadClient;
}

export function isValidDigitalAccessToken(token: string): boolean {
  return ACCESS_TOKEN_PATTERN.test(token);
}

export function isValidDigitalEntitlementId(id: string): boolean {
  return POSTGRES_UUID_PATTERN.test(id);
}

function signDigitalDownloadSession(id: string, accessTokenId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`digital-download-session-cookie-v2\0${id}\0${accessTokenId}`)
    .digest("base64url");
}

function verifiedDigitalDownloadSessionId(
  candidate: string | undefined,
  secret: string,
): { id: string; accessTokenId: string } | null {
  const match = candidate?.match(DOWNLOAD_SESSION_COOKIE_PATTERN);
  if (!match) return null;
  const id = match[1];
  const accessTokenId = match[2];
  const signature = match[3];
  if (!id || !accessTokenId || !signature || !POSTGRES_UUID_PATTERN.test(id) || !POSTGRES_UUID_PATTERN.test(accessTokenId)) return null;
  const presented = Buffer.from(signature, "base64url");
  const expected = Buffer.from(
    signDigitalDownloadSession(id, accessTokenId, secret),
    "base64url",
  );
  return presented.length === expected.length &&
    timingSafeEqual(presented, expected)
    ? { id, accessTokenId }
    : null;
}

export function getDigitalDownloadSession(
  request: NextRequest,
  accessToken: string,
  accessTokenId: string,
): {
  id: string;
  cookieValue: string;
  fingerprintHash: string;
  bearerRateLimitSubjectHash: string;
  sessionRateLimitSubjectHash: string | null;
  isNew: boolean;
} {
  const secret = getServerEnv().DIGITAL_DOWNLOAD_SESSION_SECRET?.trim();
  if (!secret) {
    throw new DigitalDownloadError("rate_limit_unavailable");
  }
  const candidate = request.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value;
  const existing = verifiedDigitalDownloadSessionId(candidate, secret);
  const isExisting = existing?.accessTokenId === accessTokenId;
  const id = isExisting ? existing.id : randomUUID();
  const cookieValue = `v2.${id}.${accessTokenId}.${signDigitalDownloadSession(id, accessTokenId, secret)}`;
  return {
    id,
    cookieValue,
    fingerprintHash: createHash("sha256")
      .update(`digital-download-session-v1\0${id}`)
      .digest("hex"),
    bearerRateLimitSubjectHash: createHash("sha256")
      .update(
        `digital-download-rate-subject-v1\0access-token\0${hashDigitalAccessToken(accessToken)}`,
      )
      .digest("hex"),
    sessionRateLimitSubjectHash: isExisting
      ? createHash("sha256")
          .update(`digital-download-rate-subject-v1\0session\0${id}`)
          .digest("hex")
      : null,
    isNew: !isExisting,
  };
}

export function getEstablishedDigitalDownloadSession(request: NextRequest) {
  const secret = getServerEnv().DIGITAL_DOWNLOAD_SESSION_SECRET?.trim();
  if (!secret) throw new DigitalDownloadError("rate_limit_unavailable");
  const established = verifiedDigitalDownloadSessionId(
    request.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value,
    secret,
  );
  if (!established) return null;
  return {
    ...established,
    fingerprintHash: createHash("sha256").update(`digital-download-session-v1\0${established.id}`).digest("hex"),
    bearerRateLimitSubjectHash: createHash("sha256").update(`digital-download-rate-subject-v2\0access-id\0${established.accessTokenId}`).digest("hex"),
    sessionRateLimitSubjectHash: createHash("sha256").update(`digital-download-rate-subject-v1\0session\0${established.id}`).digest("hex"),
  };
}

export function attachDigitalDownloadSession(
  response: NextResponse,
  session: { cookieValue: string; isNew: boolean },
) {
  if (!session.isNew) return response;
  response.cookies.set(DOWNLOAD_SESSION_COOKIE, session.cookieValue, {
    httpOnly: true,
    maxAge: DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function hardenDigitalDownloadResponse<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

async function enforceDigitalDownloadRateLimit({
  rateLimitSubjectHash,
  action,
  client = defaultClient(),
}: {
  rateLimitSubjectHash: string;
  action: "grant" | "list";
  client?: DigitalDownloadClient;
}) {
  if (!SHA_256_PATTERN.test(rateLimitSubjectHash)) {
    throw new DigitalDownloadError("rate_limit_unavailable");
  }
  const identifierHash = createHash("sha256")
    .update(`digital-download-rate-v3\0${action}\0${rateLimitSubjectHash}`)
    .digest("hex");
  const limit =
    action === "grant"
      ? DIGITAL_PRODUCT_CONFIG.downloadGrantRateLimitPerMinute
      : DIGITAL_PRODUCT_CONFIG.downloadListRateLimitPerMinute;
  let result: RpcResult;
  try {
    result = await client.rpc("check_api_rate_limit", {
      p_bucket_key: `digital-download-${action}:${identifierHash}`,
      p_limit: limit,
      p_window_ms: 60_000,
    });
  } catch {
    throw new DigitalDownloadError("rate_limit_unavailable");
  }
  if (result.error) {
    throw new DigitalDownloadError("rate_limit_unavailable");
  }
  const row = unwrapRpcRow(result.data) as
    | { allowed?: unknown; retry_after_seconds?: unknown }
    | null;
  if (!row || typeof row.allowed !== "boolean") {
    throw new DigitalDownloadError("rate_limit_unavailable");
  }
  if (!row.allowed) {
    const retryAfter =
      typeof row.retry_after_seconds === "number" &&
      Number.isInteger(row.retry_after_seconds) &&
      row.retry_after_seconds > 0
        ? row.retry_after_seconds
        : 1;
    throw new DigitalDownloadError("rate_limited", retryAfter);
  }
}

export async function enforceDigitalDownloadRateLimits({
  bearerRateLimitSubjectHash,
  sessionRateLimitSubjectHash,
  action,
  client = defaultClient(),
}: {
  bearerRateLimitSubjectHash: string;
  sessionRateLimitSubjectHash: string | null;
  action: "grant" | "list";
  client?: DigitalDownloadClient;
}) {
  await enforceDigitalDownloadRateLimit({
    rateLimitSubjectHash: bearerRateLimitSubjectHash,
    action,
    client,
  });
  if (sessionRateLimitSubjectHash) {
    await enforceDigitalDownloadRateLimit({
      rateLimitSubjectHash: sessionRateLimitSubjectHash,
      action,
      client,
    });
  }
}

export async function authorizeAccessToken({
  token,
  client = defaultClient(),
}: {
  token: string;
  client?: DigitalDownloadClient;
}): Promise<AuthorizedDigitalAccess | null> {
  if (!isValidDigitalAccessToken(token)) return null;
  let result: RpcResult;
  try {
    result = await client.rpc("authorize_digital_download_access", {
      p_token_hash: hashDigitalAccessToken(token),
    });
  } catch {
    throw new DigitalDownloadError("service_unavailable");
  }
  if (result.error) throw new DigitalDownloadError("service_unavailable");
  const row = unwrapRpcRow(result.data);
  if (!row) return null;
  const parsed = accessSchema.safeParse(row);
  if (!parsed.success) throw new DigitalDownloadError("service_unavailable");
  return parsed.data;
}

export async function authorizeAccessTokenId({ accessTokenId, client = defaultClient() }: {
  accessTokenId: string;
  client?: DigitalDownloadClient;
}): Promise<AuthorizedDigitalAccess | null> {
  if (!POSTGRES_UUID_PATTERN.test(accessTokenId)) return null;
  let result: RpcResult;
  try {
    result = await client.rpc("authorize_digital_download_session", { p_access_token_id: accessTokenId });
  } catch {
    throw new DigitalDownloadError("service_unavailable");
  }
  if (result.error) throw new DigitalDownloadError("service_unavailable");
  const row = unwrapRpcRow(result.data);
  if (!row) return null;
  const parsed = accessSchema.safeParse(row);
  if (!parsed.success) throw new DigitalDownloadError("service_unavailable");
  return parsed.data;
}

export async function listAuthorizedDigitalDownloads({
  accessTokenId,
  client = defaultClient(),
}: {
  accessTokenId: string;
  client?: DigitalDownloadClient;
}): Promise<ListedDigitalDownload[]> {
  let result: RpcResult;
  try {
    result = await client.rpc("list_authorized_digital_downloads", {
      p_access_token_id: accessTokenId,
    });
  } catch {
    throw new DigitalDownloadError("service_unavailable");
  }
  if (result.error) throw new DigitalDownloadError("service_unavailable");
  const parsed = z.array(listedDownloadSchema).safeParse(result.data ?? []);
  if (!parsed.success) throw new DigitalDownloadError("service_unavailable");
  return parsed.data.map((file) => ({
    id: file.entitlement_id,
    label: file.label,
    customerFilename: file.customer_filename,
    mimeType: file.mime_type,
    byteSize: file.byte_size,
    status: file.status,
    grantsRemaining: file.grants_remaining,
  }));
}

export async function reserveDownloadGrant({
  entitlementId,
  accessTokenId,
  clientFingerprintHash,
  client = defaultClient(),
}: {
  entitlementId: string;
  accessTokenId: string;
  clientFingerprintHash: string;
  client?: DigitalDownloadClient;
}) {
  if (
    !isValidDigitalEntitlementId(entitlementId) ||
    !POSTGRES_UUID_PATTERN.test(accessTokenId) ||
    !SHA_256_PATTERN.test(clientFingerprintHash)
  ) {
    throw new DigitalDownloadError("download_unavailable");
  }
  const reservationKey = randomUUID();
  let result: RpcResult;
  try {
    result = await client.rpc("reserve_digital_download_grant", {
      p_entitlement_id: entitlementId,
      p_access_token_id: accessTokenId,
      p_reservation_key: reservationKey,
      p_client_fingerprint_hash: clientFingerprintHash,
    });
  } catch {
    await recordDigitalProductEventBestEffort(client as never, {
      eventType: "grant_exhausted",
      dimensions: { stage: "reservation", outcome: "denied" },
    });
    throw new DigitalDownloadError("download_unavailable");
  }
  if (result.error) {
    await recordDigitalProductEventBestEffort(client as never, {
      eventType: "grant_exhausted",
      dimensions: { stage: "reservation", outcome: "denied" },
    });
    throw new DigitalDownloadError("download_unavailable");
  }
  const row = unwrapRpcRow(result.data);
  const parsed = reservationSchema.safeParse(row);
  if (!parsed.success) {
    try {
      await releaseDownloadReservation({
        entitlementId,
        accessTokenId,
        reservationKey,
        clientFingerprintHash,
        safeError: "Reservation response invalid",
        client,
      });
    } catch {
      // Reservation expiry remains the bounded cleanup backstop.
    }
    throw new DigitalDownloadError("download_unavailable");
  }
  return parsed.data;
}

export async function commitDownloadGrant({
  grantId,
  clientFingerprintHash,
  client = defaultClient(),
}: {
  grantId: string;
  clientFingerprintHash: string;
  client?: DigitalDownloadClient;
}) {
  try {
    const { data, error } = await client.rpc(
      "commit_digital_download_grant",
      {
        p_grant_id: grantId,
        p_client_fingerprint_hash: clientFingerprintHash,
      },
    );
    if (error || data !== "issued") {
      throw new DigitalDownloadError("commit_failed");
    }
  } catch (error) {
    if (error instanceof DigitalDownloadError) throw error;
    throw new DigitalDownloadError("commit_failed");
  }
}

export async function releaseDownloadGrant({
  grantId,
  clientFingerprintHash,
  safeError,
  client = defaultClient(),
}: {
  grantId: string;
  clientFingerprintHash: string;
  safeError: string;
  client?: DigitalDownloadClient;
}) {
  const { data, error } = await client.rpc("release_digital_download_grant", {
    p_grant_id: grantId,
    p_client_fingerprint_hash: clientFingerprintHash,
    p_safe_error: safeError,
  });
  if (error || (data !== "released" && data !== "issued")) {
    throw new DigitalDownloadError("download_unavailable");
  }
}

export async function releaseDownloadReservation({
  entitlementId,
  accessTokenId,
  reservationKey,
  clientFingerprintHash,
  safeError,
  client = defaultClient(),
}: {
  entitlementId: string;
  accessTokenId: string;
  reservationKey: string;
  clientFingerprintHash: string;
  safeError: string;
  client?: DigitalDownloadClient;
}) {
  const { data, error } = await client.rpc(
    "release_digital_download_reservation",
    {
      p_entitlement_id: entitlementId,
      p_access_token_id: accessTokenId,
      p_reservation_key: reservationKey,
      p_client_fingerprint_hash: clientFingerprintHash,
      p_safe_error: safeError,
    },
  );
  if (
    error ||
    (data !== "released" && data !== "missing")
  ) {
    throw new DigitalDownloadError("download_unavailable");
  }
}

export async function prepareDigitalDownload({
  entitlementId,
  accessTokenId,
  clientFingerprintHash,
  client = defaultClient(),
}: {
  entitlementId: string;
  accessTokenId: string;
  clientFingerprintHash: string;
  client?: DigitalDownloadClient;
}): Promise<string> {
  const grant = await reserveDownloadGrant({
    entitlementId,
    accessTokenId,
    clientFingerprintHash,
    client,
  });
  let committed = false;
  let safeReleaseError = "Asset lookup failed";
  try {
    let versionResult: RpcResult;
    try {
      versionResult = await client
        .from("digital_product_asset_versions")
        .select("storage_path")
        .eq("id", grant.asset_version_id)
        .eq("asset_id", grant.asset_id)
        .eq("product_id", grant.product_id)
        .eq("store_id", grant.store_id)
        .maybeSingle();
    } catch {
      await recordDigitalProductEventBestEffort(client as never, {
        eventType: "download_signing_failed",
        storeId: grant.store_id,
        productId: grant.product_id,
        dimensions: { stage: "storage_signing", outcome: "failed" },
      });
      throw new DigitalDownloadError("preparation_failed");
    }
    const storagePath = storagePathSchema.safeParse(versionResult.data);
    if (versionResult.error || !storagePath.success) {
      throw new DigitalDownloadError("preparation_failed");
    }

    safeReleaseError = "Storage signing failed";
    let signedResult: {
      data: { signedUrl?: string } | null;
      error: { message?: string } | null;
    };
    try {
      signedResult = await client.storage
        .from(DIGITAL_ASSET_BUCKET)
        .createSignedUrl(
          storagePath.data.storage_path,
          DIGITAL_PRODUCT_CONFIG.signedDownloadTtlSeconds,
          { download: grant.customer_filename },
        );
    } catch {
      throw new DigitalDownloadError("preparation_failed");
    }
    const signedUrl = signedResult.data?.signedUrl;
    if (
      signedResult.error ||
      !signedUrl ||
      !/^https?:\/\//i.test(signedUrl)
    ) {
      await recordDigitalProductEventBestEffort(client as never, {
        eventType: "download_signing_failed",
        storeId: grant.store_id,
        productId: grant.product_id,
        dimensions: { stage: "storage_signing", outcome: "failed" },
      });
      throw new DigitalDownloadError("preparation_failed");
    }

    safeReleaseError = "Grant commit failed";
    await commitDownloadGrant({
      grantId: grant.grant_id,
      clientFingerprintHash,
      client,
    });
    committed = true;
    return signedUrl;
  } finally {
    if (!committed) {
      try {
        await releaseDownloadGrant({
          grantId: grant.grant_id,
          clientFingerprintHash,
          safeError: safeReleaseError,
          client,
        });
      } catch {
        // The database reservation expiry remains the bounded cleanup backstop.
      }
    }
  }
}
