import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StripeWebhookEventRow = {
  stripe_event_id: string;
  event_type: string;
  status: "processing" | "processed" | "failed";
  attempt_count: number;
  last_attempt_at: string;
};

const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

export async function beginStripeWebhookEventProcessing(eventId: string, eventType: string) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const insertResult = await admin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: eventId,
      event_type: eventType,
      status: "processing",
      attempt_count: 1,
      last_attempt_at: now
    })
    .select("stripe_event_id,event_type,status,attempt_count,last_attempt_at")
    .single<StripeWebhookEventRow>();

  if (!insertResult.error) {
    return { shouldProcess: true as const };
  }

  if ((insertResult.error as { code?: string }).code !== "23505") {
    throw new Error(insertResult.error.message);
  }

  const existingResult = await admin
    .from("stripe_webhook_events")
    .select("stripe_event_id,event_type,status,attempt_count,last_attempt_at")
    .eq("stripe_event_id", eventId)
    .maybeSingle<StripeWebhookEventRow>();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  const existing = existingResult.data;
  if (!existing) {
    return { shouldProcess: true as const };
  }

  if (existing.status === "processed") {
    return { shouldProcess: false as const, reason: "processed" as const };
  }

  const lastAttemptAtMs = Date.parse(existing.last_attempt_at);
  const processingIsFresh =
    existing.status === "processing" &&
    Number.isFinite(lastAttemptAtMs) &&
    Date.now() - lastAttemptAtMs < PROCESSING_STALE_AFTER_MS;

  if (processingIsFresh) {
    return { shouldProcess: false as const, reason: "processing" as const };
  }

  const { error: updateError } = await admin
    .from("stripe_webhook_events")
    .update({
      event_type: eventType,
      status: "processing",
      attempt_count: existing.attempt_count + 1,
      last_attempt_at: now,
      error_message: null
    })
    .eq("stripe_event_id", eventId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { shouldProcess: true as const };
}

export async function markStripeWebhookEventProcessed(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null
    })
    .eq("stripe_event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markStripeWebhookEventFailed(eventId: string, errorMessage: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      error_message: errorMessage,
      last_attempt_at: new Date().toISOString()
    })
    .eq("stripe_event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}
