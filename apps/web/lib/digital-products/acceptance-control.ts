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
  const [{ data: order }, { data: job }, { data: grants }, { data: entitlements }, { data: notifications }, { data: manifestItems }, { data: refunds }, { data: disputes }, { data: deliveryAttempts }, { data: orderItems }] = await Promise.all([
    supabase.from("orders").select("id,store_id,status,payment_status,refund_status,dispute_status,stripe_payment_intent_id,checkout_composition").eq("id", input.subjectId).maybeSingle(),
    supabase.from("digital_delivery_jobs").select("id,status,attempt_count,last_safe_error").eq("order_id", input.subjectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("digital_download_grants").select("id,entitlement_id,status,asset_version_id,created_at,released_at,last_safe_error").eq("order_id", input.subjectId).order("created_at", { ascending: true }),
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
  const { data: catalogAssetVersions } = productIds.length ? await supabase.from("digital_assets").select("id,current_version_id,customer_filename").in("product_id", productIds).eq("is_active", true).not("current_version_id", "is", null) : { data: [] };
  const paymentIntentId = order && "stripe_payment_intent_id" in order ? order.stripe_payment_intent_id : null;
  const providerPayment = typeof paymentIntentId === "string"
    ? await getStripeClient().paymentIntents.retrieve(paymentIntentId).then((payment) => ({ id: payment.id, status: payment.status, livemode: payment.livemode }))
    : null;
  return digitalAcceptanceObservationSchema.parse({ version: 1, runId: input.runId, subjectId: input.subjectId, observedAt: new Date().toISOString(), observation: { order, deliveryJob: job, grants: grants ?? [], entitlements: entitlements ?? [], notifications: notifications ?? [], manifestItems: manifestItems ?? [], providerPayment, refunds: refunds ?? [], disputes: disputes ?? [], webhookEvents: webhookEvents ?? [], deliveryAttempts: deliveryAttempts ?? [], catalogAssetVersions: catalogAssetVersions ?? [] } });
}
