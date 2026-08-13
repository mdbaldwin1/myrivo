import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveDigitalAccessToken, hashDigitalAccessToken } from "./entitlements";

type CheckoutAccessRow = {
  token_derivation_nonce: string;
  token_hash: string;
  expires_at: string;
};

type CheckoutAccessQuery = {
  select: (columns: string) => CheckoutAccessQuery;
  eq: (column: string, value: string) => CheckoutAccessQuery;
  is: (column: string, value: null) => CheckoutAccessQuery;
  maybeSingle: () => PromiseLike<{
    data: CheckoutAccessRow | null;
    error: { message?: string } | null;
  }>;
};

export type CheckoutAccessClient = {
  from: (table: string) => CheckoutAccessQuery;
};

const inputSchema = z.object({
  orderId: z.string().uuid(),
  jobId: z.string().uuid(),
  secret: z.string().trim().min(32),
});

const accessRowSchema = z.object({
  token_derivation_nonce: z.string().uuid(),
  token_hash: z.string().regex(/^[a-f0-9]{64}$/),
  expires_at: z.string().datetime({ offset: true }),
});

function hashesMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function loadCheckoutDigitalAccessUrl({
  orderId,
  jobId,
  secret,
  now = new Date(),
  client = createSupabaseAdminClient() as unknown as CheckoutAccessClient,
}: {
  orderId: string;
  jobId: string;
  secret: string;
  now?: Date;
  client?: CheckoutAccessClient;
}): Promise<string | null> {
  const parsedInput = inputSchema.safeParse({ orderId, jobId, secret });
  if (!parsedInput.success || Number.isNaN(now.getTime())) {
    return null;
  }

  const { data, error } = await client
    .from("digital_order_access_tokens")
    .select("token_derivation_nonce,token_hash,expires_at")
    .eq("order_id", parsedInput.data.orderId)
    .eq("delivery_job_id", parsedInput.data.jobId)
    .eq("issuance_reason", "purchase")
    .is("revoked_at", null)
    .maybeSingle();

  const row = accessRowSchema.safeParse(data);
  if (error || !row.success || new Date(row.data.expires_at).getTime() <= now.getTime()) {
    return null;
  }

  const token = deriveDigitalAccessToken({
    jobId: parsedInput.data.jobId,
    nonce: row.data.token_derivation_nonce,
    secret: parsedInput.data.secret,
  });
  if (!hashesMatch(hashDigitalAccessToken(token), row.data.token_hash)) {
    return null;
  }

  return `/downloads/${token}`;
}
