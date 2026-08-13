import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/server";

export const digitalAcceptanceControlSchema = z.object({
  version: z.literal(1),
  action: z.enum(["observe", "expire-access", "inject-delivery-failure", "inject-refund", "inject-dispute"]),
  runId: z.string().uuid(),
  subjectId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  transition: z.enum(["partial", "full", "opened", "won", "lost"]).optional(),
}).strict();

export type DigitalAcceptanceControlInput = z.infer<typeof digitalAcceptanceControlSchema>;

export async function executeDigitalAcceptanceControl(input: DigitalAcceptanceControlInput) {
  const supabase = createSupabaseAdminClient();
  if (input.action !== "observe") {
    const { error } = await supabase.rpc("acceptance_control_digital_products", {
      p_version: input.version, p_action: input.action, p_run_id: input.runId,
      p_subject_id: input.subjectId, p_transition: input.transition ?? null,
      p_idempotency_key: input.idempotencyKey,
      p_environment: process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT,
      p_project_ref: process.env.MYRIVO_DIGITAL_ACCEPTANCE_PROJECT_REF,
    });
    if (error) throw error;
  }
  const [{ data: order }, { data: job }, { data: grants }, { data: notifications }, { data: manifestItems }] = await Promise.all([
    supabase.from("orders").select("id,store_id,status,payment_status,refund_status,dispute_status,stripe_payment_intent_id,checkout_composition").eq("id", input.subjectId).maybeSingle(),
    supabase.from("digital_delivery_jobs").select("id,status,attempt_count,last_safe_error").eq("order_id", input.subjectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("digital_download_grants").select("id,status,asset_version_id").eq("order_id", input.subjectId),
    supabase.from("digital_delivery_notifications").select("id,notification_type,status,provider,attempt_count,sent_at").eq("order_id", input.subjectId).order("created_at", { ascending: true }),
    supabase.from("digital_purchase_manifest_items").select("asset_version_id,customer_filename").eq("order_id", input.subjectId),
  ]);
  const paymentIntentId = order && "stripe_payment_intent_id" in order ? order.stripe_payment_intent_id : null;
  const providerPayment = typeof paymentIntentId === "string"
    ? await getStripeClient().paymentIntents.retrieve(paymentIntentId).then((payment) => ({ id: payment.id, status: payment.status, livemode: payment.livemode }))
    : null;
  return { version: 1, runId: input.runId, observedAt: new Date().toISOString(), observation: { order, deliveryJob: job, grants: grants ?? [], notifications: notifications ?? [], manifestItems: manifestItems ?? [], providerPayment } };
}
