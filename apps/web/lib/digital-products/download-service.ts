import { createHash, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_ASSET_BUCKET } from "./assets";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import { hashDigitalAccessToken } from "./entitlements";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const DOWNLOAD_SESSION_COOKIE = "myrivo_download_session";

const accessSchema = z.object({
  access_token_id: z.string().regex(POSTGRES_UUID_PATTERN),
  order_id: z.string().regex(POSTGRES_UUID_PATTERN),
  store_id: z.string().regex(POSTGRES_UUID_PATTERN),
  expires_at: z.string().datetime({ offset: true }),
});

const listedDownloadSchema = z.object({
  entitlement_id: z.string().regex(POSTGRES_UUID_PATTERN),
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

export function getDigitalDownloadSession(request: NextRequest): {
  id: string;
  fingerprintHash: string;
  isNew: boolean;
} {
  const candidate = request.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value;
  const isExisting = Boolean(candidate && POSTGRES_UUID_PATTERN.test(candidate));
  const id = isExisting ? String(candidate) : randomUUID();
  return {
    id,
    fingerprintHash: createHash("sha256")
      .update(`digital-download-session-v1\0${id}`)
      .digest("hex"),
    isNew: !isExisting,
  };
}

export function attachDigitalDownloadSession(
  response: NextResponse,
  session: { id: string; isNew: boolean },
) {
  if (!session.isNew) return response;
  response.cookies.set(DOWNLOAD_SESSION_COOKIE, session.id, {
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

function getRequestAddress(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function enforceDigitalDownloadRateLimit({
  request,
  action,
  client = defaultClient(),
}: {
  request: NextRequest;
  action: "grant" | "list";
  client?: DigitalDownloadClient;
}) {
  const identifierHash = createHash("sha256")
    .update(`digital-download-rate-v1\0${getRequestAddress(request)}`)
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
  let result: RpcResult;
  try {
    result = await client.rpc("reserve_digital_download_grant", {
      p_entitlement_id: entitlementId,
      p_access_token_id: accessTokenId,
      p_reservation_key: randomUUID(),
      p_client_fingerprint_hash: clientFingerprintHash,
    });
  } catch {
    throw new DigitalDownloadError("download_unavailable");
  }
  if (result.error) throw new DigitalDownloadError("download_unavailable");
  const parsed = reservationSchema.safeParse(unwrapRpcRow(result.data));
  if (!parsed.success) throw new DigitalDownloadError("download_unavailable");
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
