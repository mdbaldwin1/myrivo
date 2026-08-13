import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { getExternalAppUrl } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import type { DigitalDeliveryJobClaim } from "./delivery-jobs";

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type DigitalDeliveryRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

const materializationSchema = z.object({
  entitlement_count: z.number().int().positive(),
  access_token_id: z.string().uuid(),
  token_derivation_nonce: z.string().uuid(),
  token_hash: z.string().regex(/^[a-f0-9]{64}$/),
  expires_at: z.string().datetime({ offset: true }),
  customer_email: z.string().email().optional(),
  store_name: z.string().trim().min(1).optional(),
});

export type DigitalEntitlementMaterialization = {
  accessToken: string;
  accessUrl: string;
  accessTokenId: string;
  entitlementCount: number;
  expiresAt: string;
  customerEmail: string | null;
  storeName: string | null;
};

export function hashDigitalAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function deriveDigitalAccessToken({
  jobId,
  nonce,
  secret,
}: {
  jobId: string;
  nonce: string;
  secret: string;
}) {
  return createHmac("sha256", secret)
    .update(`purchase-delivery-v1:${jobId}:${nonce}`)
    .digest("base64url");
}

export async function materializeEntitlementsFromManifest({
  job,
  tokenSecret,
  client = createSupabaseAdminClient(),
  externalAppUrl = getExternalAppUrl(),
}: {
  job: DigitalDeliveryJobClaim;
  tokenSecret: string;
  client?: DigitalDeliveryRpcClient;
  externalAppUrl?: string;
}): Promise<DigitalEntitlementMaterialization> {
  if (tokenSecret.trim().length < 32) {
    throw new Error("Digital delivery token configuration is unavailable");
  }

  const requestedNonce = randomUUID();
  const requestedToken = deriveDigitalAccessToken({
    jobId: job.id,
    nonce: requestedNonce,
    secret: tokenSecret,
  });
  const { data, error } = await client.rpc(
    "materialize_digital_delivery_from_manifest",
    {
      p_job_id: job.id,
      p_lease_token: job.leaseToken,
      p_token_derivation_nonce: requestedNonce,
      p_token_hash: hashDigitalAccessToken(requestedToken),
      p_access_ttl_seconds:
        DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60,
      p_max_download_grants: DIGITAL_PRODUCT_CONFIG.grantsPerFile,
    },
  );

  if (error) {
    throw new Error(error.message || "Digital delivery materialization failed");
  }

  const parsed = materializationSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Digital delivery materialization returned an invalid result");
  }

  const accessToken = deriveDigitalAccessToken({
    jobId: job.id,
    nonce: parsed.data.token_derivation_nonce,
    secret: tokenSecret,
  });
  if (hashDigitalAccessToken(accessToken) !== parsed.data.token_hash) {
    throw new Error("Digital delivery token integrity check failed");
  }

  return {
    accessToken,
    accessUrl: `${externalAppUrl.replace(/\/$/, "")}/downloads#token=${accessToken}`,
    accessTokenId: parsed.data.access_token_id,
    entitlementCount: parsed.data.entitlement_count,
    expiresAt: parsed.data.expires_at,
    customerEmail: parsed.data.customer_email ?? null,
    storeName: parsed.data.store_name ?? null,
  };
}
