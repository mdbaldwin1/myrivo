import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type QueryResult = { data: unknown; error: { message?: string } | null };

type OrderSummaryQuery = {
  select: (columns: string) => OrderSummaryQuery;
  eq: (column: string, value: string) => OrderSummaryQuery;
  is: (column: string, value: null) => OrderSummaryQuery;
  in: (column: string, values: string[]) => OrderSummaryQuery;
  order: (column: string, options?: { ascending?: boolean }) => OrderSummaryQuery;
  returns: () => PromiseLike<QueryResult>;
};

export type OrderSummaryClient = {
  from: (table: string) => OrderSummaryQuery;
};

const deliveryStatusSchema = z.enum(["pending", "processing", "succeeded", "failed"]);
const entitlementStatusSchema = z.enum(["active", "suspended", "revoked"]);
const manifestItemSchema = z.object({
  order_item_id: z.string().uuid(),
  asset_version_id: z.string().uuid(),
  label: z.string().trim().min(1),
  customer_filename: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  sort_order: z.number().int().nonnegative()
});
const entitlementSchema = z.object({
  order_item_id: z.string().uuid(),
  asset_version_id: z.string().uuid(),
  customer_filename: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  max_download_grants: z.number().int().positive(),
  download_grants_used: z.number().int().nonnegative(),
  status: entitlementStatusSchema,
  first_accessed_at: z.string().datetime({ offset: true }).nullable(),
  last_accessed_at: z.string().datetime({ offset: true }).nullable()
});
const jobSchema = z.object({ id: z.string().uuid(), status: deliveryStatusSchema });
const notificationSchema = z.object({ id: z.string().uuid(), status: deliveryStatusSchema });
const attemptSchema = z.object({
  attempt_number: z.number().int().positive(),
  status: z.enum(["processing", "succeeded", "failed"]),
  started_at: z.string().datetime({ offset: true }),
  finished_at: z.string().datetime({ offset: true }).nullable()
});
const accessTokenSchema = z.object({ expires_at: z.string().datetime({ offset: true }) });

export type MerchantDigitalOrderSummary = {
  fileCount: number;
  deliveryStatus: z.infer<typeof deliveryStatusSchema>;
  notificationStatus: z.infer<typeof deliveryStatusSchema> | "not_queued";
  accessStatus: z.infer<typeof entitlementStatusSchema> | "expired" | "pending";
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  attempts: Array<{ attemptNumber: number; status: "processing" | "succeeded" | "failed"; startedAt: string; finishedAt: string | null }>;
  notificationAttempts: Array<{ attemptNumber: number; status: "processing" | "succeeded" | "failed"; startedAt: string; finishedAt: string | null }>;
  files: Array<{
    label: string;
    filename: string;
    format: string;
    grantsRemaining: number | null;
    status: z.infer<typeof entitlementStatusSchema> | "pending";
  }>;
  activeLinkExpiresAt: string | null;
  activeDisputeStatus: string | null;
};

function unwrapRows<T>(result: QueryResult, schema: z.ZodType<T[]>): T[] {
  if (result.error) {
    throw new Error(result.error.message || "Digital order state could not be loaded");
  }
  const parsed = schema.safeParse(result.data ?? []);
  if (!parsed.success) {
    throw new Error("Digital order state returned an invalid result");
  }
  return parsed.data;
}

function fileKey(value: { order_item_id: string; asset_version_id: string }) {
  return `${value.order_item_id}:${value.asset_version_id}`;
}

function displayFormat(mimeType: string) {
  const subtype = mimeType.split("/").at(-1)?.toLowerCase() ?? "file";
  if (subtype === "jpeg") return "JPG";
  return subtype.toUpperCase();
}

function latestTimestamp(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function earliestTimestamp(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(0) ?? null;
}

export async function loadMerchantDigitalOrderSummary({
  orderId,
  storeId,
  activeDisputeStatus,
  now = new Date(),
  client = createSupabaseAdminClient() as unknown as OrderSummaryClient
}: {
  orderId: string;
  storeId: string;
  activeDisputeStatus: string | null;
  now?: Date;
  client?: OrderSummaryClient;
}): Promise<MerchantDigitalOrderSummary> {
  z.string().uuid().parse(orderId);
  z.string().uuid().parse(storeId);

  const [manifestResult, entitlementResult, jobResult, notificationResult, tokenResult] = await Promise.all([
    client.from("digital_purchase_manifest_items")
      .select("order_item_id,asset_version_id,label,customer_filename,mime_type,sort_order")
      .eq("order_id", orderId).eq("store_id", storeId).order("sort_order", { ascending: true }).returns(),
    client.from("digital_order_entitlements")
      .select("order_item_id,asset_version_id,customer_filename,mime_type,max_download_grants,download_grants_used,status,first_accessed_at,last_accessed_at")
      .eq("order_id", orderId).eq("store_id", storeId).order("created_at", { ascending: true }).returns(),
    client.from("digital_delivery_jobs")
      .select("id,status").eq("order_id", orderId).eq("store_id", storeId).order("created_at", { ascending: false }).returns(),
    client.from("digital_delivery_notifications")
      .select("id,status").eq("order_id", orderId).eq("store_id", storeId).order("created_at", { ascending: false }).returns(),
    client.from("digital_order_access_tokens")
      .select("expires_at").eq("order_id", orderId).eq("store_id", storeId).is("revoked_at", null).order("expires_at", { ascending: false }).returns()
  ]);

  const manifestItems = unwrapRows(manifestResult, z.array(manifestItemSchema));
  const entitlements = unwrapRows(entitlementResult, z.array(entitlementSchema));
  const jobs = unwrapRows(jobResult, z.array(jobSchema));
  const notifications = unwrapRows(notificationResult, z.array(notificationSchema));
  const accessTokens = unwrapRows(tokenResult, z.array(accessTokenSchema));

  const [attemptResult, notificationAttemptResult] = await Promise.all([
    jobs.length > 0
      ? client.from("digital_delivery_attempts")
          .select("attempt_number,status,started_at,finished_at").in("job_id", jobs.map(({ id }) => id))
          .order("attempt_number", { ascending: true }).returns()
      : Promise.resolve({ data: [], error: null }),
    notifications.length > 0
      ? client.from("digital_delivery_notification_attempts")
          .select("attempt_number,status,started_at,finished_at").in("notification_id", notifications.map(({ id }) => id))
          .order("started_at", { ascending: true }).returns()
      : Promise.resolve({ data: [], error: null })
  ]);
  const attempts = unwrapRows(attemptResult, z.array(attemptSchema));
  const notificationAttempts = unwrapRows(notificationAttemptResult, z.array(attemptSchema));
  const entitlementByFile = new Map(entitlements.map((entitlement) => [fileKey(entitlement), entitlement]));
  const sourceFiles = manifestItems.length > 0
    ? manifestItems
    : entitlements.map((entitlement, sortOrder) => ({
        ...entitlement,
        label: entitlement.customer_filename,
        sort_order: sortOrder
      }));
  const files = sourceFiles.map((file) => {
    const entitlement = entitlementByFile.get(fileKey(file));
    return {
      label: file.label,
      filename: file.customer_filename,
      format: displayFormat(file.mime_type),
      grantsRemaining: entitlement
        ? Math.max(0, entitlement.max_download_grants - entitlement.download_grants_used)
        : null,
      status: entitlement?.status ?? "pending" as const
    };
  });
  const validActiveToken = accessTokens.find(({ expires_at }) => new Date(expires_at).getTime() > now.getTime()) ?? null;
  const accessStatus: MerchantDigitalOrderSummary["accessStatus"] = entitlements.length === 0
    ? "pending"
    : entitlements.every(({ status }) => status === "revoked")
      ? "revoked"
      : activeDisputeStatus || entitlements.some(({ status }) => status === "suspended")
        ? "suspended"
        : validActiveToken ? "active" : "expired";

  return {
    fileCount: files.length,
    deliveryStatus: jobs[0]?.status ?? "pending",
    notificationStatus: notifications[0]?.status ?? "not_queued",
    accessStatus,
    firstAccessedAt: earliestTimestamp(entitlements.map(({ first_accessed_at }) => first_accessed_at)),
    lastAccessedAt: latestTimestamp(entitlements.map(({ last_accessed_at }) => last_accessed_at)),
    attempts: attempts.map((attempt) => ({
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at
    })),
    notificationAttempts: notificationAttempts.map((attempt) => ({
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at
    })),
    files,
    activeLinkExpiresAt: validActiveToken?.expires_at ?? null,
    activeDisputeStatus
  };
}
