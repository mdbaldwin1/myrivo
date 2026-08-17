import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/server";
import { digitalAcceptanceObservationSchema } from "@/lib/digital-products/acceptance-evidence";

export const digitalAcceptanceControlSchema = z.object({
  version: z.literal(1),
  action: z.enum(["observe", "expire-access", "inject-delivery-failure", "inject-signing-failure", "inject-refund", "inject-dispute"]),
  runId: z.string().uuid(),
  subjectId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  transition: z.enum(["partial", "full", "opened", "won", "lost"]).optional(),
}).strict();

export type DigitalAcceptanceControlInput = z.infer<typeof digitalAcceptanceControlSchema>;

export async function executeDigitalAcceptanceControl(input: DigitalAcceptanceControlInput) {
  const supabase = createSupabaseAdminClient();
  {
    const { error } = await supabase.rpc("acceptance_control_digital_products", {
      p_version: input.version, p_action: input.action, p_run_id: input.runId,
      p_subject_id: input.subjectId, p_transition: input.transition ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw error;
  }
  const [{ data: orderRow }, { data: checkoutSession }, { data: allRefunds }, { data: allDisputes }, { data: job }, { data: grantRows }, { data: entitlements }, { data: notifications }, { data: manifestItems }, { data: refunds }, { data: disputes }, { data: deliveryAttempts }, { data: orderItems }] = await Promise.all([
    supabase.from("orders").select("id,store_id,status,total_cents,stripe_payment_intent_id").eq("id", input.subjectId).maybeSingle(),
    supabase.from("storefront_checkout_sessions").select("checkout_composition").eq("order_id", input.subjectId).not("checkout_composition", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("order_refunds").select("amount_cents,status").eq("order_id", input.subjectId),
    supabase.from("order_disputes").select("status,created_at").eq("order_id", input.subjectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("digital_delivery_jobs").select("id,status,attempt_count,last_safe_error").eq("order_id", input.subjectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("digital_download_grants").select("id,entitlement_id,status,reserved_at,released_at,last_safe_error").eq("order_id", input.subjectId).order("reserved_at", { ascending: true }),
    supabase.from("digital_order_entitlements").select("id,asset_version_id,download_grants_used,customer_filename,status").eq("order_id", input.subjectId),
    supabase.from("digital_delivery_notifications").select("id,notification_type,status,provider,provider_message_id,attempt_count,sent_at").eq("order_id", input.subjectId).order("created_at", { ascending: true }),
    supabase.from("digital_purchase_manifest_items").select("asset_version_id,customer_filename").eq("order_id", input.subjectId),
    supabase.from("order_refunds").select("stripe_refund_id,amount_cents,status,source_event_id").eq("order_id", input.subjectId).not("stripe_refund_id", "is", null).not("source_event_id", "is", null),
    supabase.from("order_disputes").select("stripe_dispute_id,stripe_charge_id,stripe_payment_intent_id,status,source_event_id").eq("order_id", input.subjectId).not("source_event_id", "is", null),
    supabase.from("digital_delivery_attempts").select("job_id,attempt_number,status,started_at,finished_at").eq("order_id", input.subjectId).order("attempt_number", { ascending: true }),
    supabase.from("order_items").select("product_id").eq("order_id", input.subjectId).not("product_id", "is", null),
  ]);
  const eventIds = [...(refunds ?? []), ...(disputes ?? [])].map((row) => row.source_event_id).filter((value): value is string => typeof value === "string");
  const { data: webhookEvents } = eventIds.length ? await supabase.from("stripe_webhook_events").select("stripe_event_id,event_type,status,signature_verified,attempt_count,last_attempt_at,processed_at,created_at").in("stripe_event_id", eventIds) : { data: [] };
  const productIds = [...new Set((orderItems ?? []).map((item) => item.product_id).filter((value): value is string => typeof value === "string"))];
  const { data: catalogAssets } = productIds.length
    ? await supabase.from("digital_product_assets").select("id,digital_product_asset_versions(id,customer_filename,status,retired_at,version_number)").in("product_id", productIds).eq("active", true)
    : { data: [] };
  const catalogAssetVersions = (catalogAssets ?? []).flatMap((asset) => {
    const versions = (asset.digital_product_asset_versions ?? [])
      .filter((version) => version.status === "ready" && version.retired_at === null)
      .sort((left, right) => right.version_number - left.version_number);
    const current = versions[0];
    return current ? [{ id: asset.id, current_version_id: current.id, customer_filename: current.customer_filename }] : [];
  });
  // Derived financial summaries: the schema exposes them as order-level fields
  // while the application persists them in order_refunds / order_disputes.
  const refundedCents = (allRefunds ?? []).filter((row) => row.status === "succeeded").reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const order = orderRow
    ? {
        id: orderRow.id,
        store_id: orderRow.store_id,
        status: orderRow.status,
        payment_status: orderRow.status === "paid" ? "paid" : null,
        refund_status: refundedCents <= 0 ? null : refundedCents >= (orderRow.total_cents ?? 0) ? "full" : "partial",
        dispute_status: allDisputes?.status ?? null,
        stripe_payment_intent_id: orderRow.stripe_payment_intent_id,
        checkout_composition: checkoutSession?.checkout_composition ?? null,
      }
    : null;
  const assetVersionByEntitlement = new Map((entitlements ?? []).map((entitlement) => [entitlement.id, entitlement.asset_version_id]));
  const grants = (grantRows ?? []).map((grant) => ({
    id: grant.id,
    entitlement_id: grant.entitlement_id,
    status: grant.status,
    // Evidence must report the observed version, never a stand-in: an
    // unrelated identifier still satisfies the artifact schema and would be
    // compared against real versions as though it had been observed.
    asset_version_id: (() => {
      const observed = assetVersionByEntitlement.get(grant.entitlement_id);
      if (!observed) throw new Error("Digital download grant has no observable asset version.");
      return observed;
    })(),
    created_at: grant.reserved_at,
    released_at: grant.released_at,
    last_safe_error: grant.last_safe_error,
  }));
  const paymentIntentId = order ? order.stripe_payment_intent_id : null;
  const providerPayment = typeof paymentIntentId === "string"
    ? await getStripeClient().paymentIntents.retrieve(paymentIntentId).then((payment) => ({ id: payment.id, status: payment.status, livemode: payment.livemode }))
    : null;
  return digitalAcceptanceObservationSchema.parse({ version: 1, runId: input.runId, subjectId: input.subjectId, observedAt: new Date().toISOString(), observation: { order, deliveryJob: job, grants: grants ?? [], entitlements: entitlements ?? [], notifications: notifications ?? [], manifestItems: manifestItems ?? [], providerPayment, refunds: refunds ?? [], disputes: disputes ?? [], webhookEvents: webhookEvents ?? [], deliveryAttempts: deliveryAttempts ?? [], catalogAssetVersions: catalogAssetVersions ?? [] } });
}
