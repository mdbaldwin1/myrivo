import { createHash } from "node:crypto";
import { notificationConfig } from "@/lib/notifications/config";
import { type NotificationChannelTarget, getNotificationCatalogEntry } from "@/lib/notifications/catalog";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import {
  isChannelEnabledForEvent,
  resolveAccountNotificationPreferences,
  type AccountNotificationPreferences
} from "@/lib/notifications/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NotificationSeverity, NotificationStatus } from "@/types/database";

type RecipientProfile = {
  id: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

export type NotificationDispatchInput = {
  recipientUserId: string;
  storeId?: string | null;
  eventType: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  severity?: NotificationSeverity;
  channelTargets?: NotificationChannelTarget[];
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  email?: {
    from: string;
    subject: string;
    text: string;
    replyTo?: string | null;
  };
};

export type NotificationDispatchResult = {
  ok: boolean;
  notificationId: string | null;
  targets: NotificationChannelTarget[];
  skipped: boolean;
  reason: string | null;
};

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "23505";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

function buildAutoDedupeKey(input: NotificationDispatchInput) {
  const windowMs = Math.max(1, notificationConfig.dispatchIdempotencyWindowMinutes) * 60 * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const payloadFingerprint = stableStringify({
    storeId: input.storeId ?? null,
    eventType: input.eventType,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
    metadata: input.metadata ?? {}
  });
  const digest = createHash("sha1").update(payloadFingerprint).digest("hex").slice(0, 16);
  return `auto:${input.eventType}:${input.storeId ?? "none"}:${bucket}:${digest}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveNotificationChannels(
  eventType: string,
  preferences: AccountNotificationPreferences,
  requestedTargets?: NotificationChannelTarget[]
) {
  const entry = getNotificationCatalogEntry(eventType);
  const baseTargets = requestedTargets && requestedTargets.length > 0 ? requestedTargets : entry.defaultTargets;
  const deduped = Array.from(new Set(baseTargets));
  return deduped.filter((channel) => isChannelEnabledForEvent(preferences, eventType, channel));
}

async function loadRecipientProfile(recipientUserId: string): Promise<RecipientProfile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,email,metadata")
    .eq("id", recipientUserId)
    .maybeSingle<RecipientProfile>();

  if (error) {
    throw new Error(error.message);
  }
  return data ?? null;
}

async function fetchExistingNotificationByDedupe(recipientUserId: string, dedupeKey: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("recipient_user_id", recipientUserId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function isDispatchThrottled(recipientUserId: string, eventType: string, storeId: string | null | undefined) {
  const maxPerWindow = Math.max(1, notificationConfig.dispatchThrottleMaxPerWindow);
  const windowMinutes = Math.max(1, notificationConfig.dispatchThrottleWindowMinutes);
  const thresholdIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", recipientUserId)
    .eq("event_type", eventType)
    .gte("created_at", thresholdIso);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) >= maxPerWindow;
}

async function recordDeliveryAttempt(input: {
  notificationId: string;
  status: "sent" | "failed";
  provider: string;
  error: string | null;
  attempt: number;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notification_delivery_attempts").insert({
    notification_id: input.notificationId,
    channel: "email",
    provider: input.provider,
    status: input.status,
    error: input.error,
    response_json: {
      attempt: input.attempt
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function dispatchNotification(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
  const entry = getNotificationCatalogEntry(input.eventType);
  const profile = await loadRecipientProfile(input.recipientUserId);
  const preferences = resolveAccountNotificationPreferences(profile?.metadata);
  const targets = resolveNotificationChannels(input.eventType, preferences, input.channelTargets);

  if (targets.length === 0) {
    return {
      ok: true,
      notificationId: null,
      targets: [],
      skipped: true,
      reason: "No channels enabled for this event."
    };
  }

  const throttled = await isDispatchThrottled(input.recipientUserId, input.eventType, input.storeId);
  if (throttled) {
    return {
      ok: true,
      notificationId: null,
      targets,
      skipped: true,
      reason: "Throttled by dispatch window."
    };
  }

  const dedupeKey = input.dedupeKey ?? buildAutoDedupeKey(input);
  const supabase = createSupabaseAdminClient();
  const baseStatus: NotificationStatus = targets.includes("in_app") ? "pending" : "sent";
  const notificationInsert = {
    store_id: input.storeId ?? null,
    recipient_user_id: input.recipientUserId,
    recipient_email: profile?.email ?? null,
    event_type: input.eventType,
    title: input.title,
    body: input.body,
    action_url: input.actionUrl ?? null,
    severity: input.severity ?? entry.defaultSeverity,
    channel_targets: {
      inApp: targets.includes("in_app"),
      email: targets.includes("email")
    },
    status: baseStatus,
    sent_at: baseStatus === "sent" ? new Date().toISOString() : null,
    dedupe_key: dedupeKey,
    metadata: input.metadata ?? {}
  };

  const { data, error } = await supabase.from("notifications").insert(notificationInsert).select("id").maybeSingle<{ id: string }>();

  let notificationId = data?.id ?? null;
  if (error) {
    if (dedupeKey && isUniqueConstraintError(error)) {
      notificationId = await fetchExistingNotificationByDedupe(input.recipientUserId, dedupeKey);
      return {
        ok: true,
        notificationId,
        targets,
        skipped: false,
        reason: "Duplicate suppressed by dedupe key."
      };
    }
    throw new Error(error.message);
  }

  if (!notificationId) {
    throw new Error("Notification insert did not return an id.");
  }

  if (targets.includes("email")) {
    if (!input.email || !profile?.email) {
      await recordDeliveryAttempt({
        notificationId,
        status: "failed",
        provider: "resend",
        error: "Email target requested but message payload or recipient email is missing.",
        attempt: 1
      });

      await supabase
        .from("notifications")
        .update({
          status: "failed",
          sent_at: null
        })
        .eq("id", notificationId);
    } else {
      const attempts = Math.max(1, notificationConfig.emailRetryAttempts);
      const baseDelayMs = Math.max(50, notificationConfig.emailRetryBaseDelayMs);
      let finalStatus: NotificationStatus = "failed";
      let sentAt: string | null = null;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const emailResult = await sendTransactionalEmail({
          from: input.email.from,
          to: [profile.email],
          subject: input.email.subject,
          text: input.email.text,
          replyTo: input.email.replyTo ?? null
        });

        await recordDeliveryAttempt({
          notificationId,
          status: emailResult.ok ? "sent" : "failed",
          provider: emailResult.provider,
          error: emailResult.error,
          attempt
        });

        if (emailResult.ok) {
          finalStatus = baseStatus;
          sentAt = new Date().toISOString();
          break;
        }

        if (attempt < attempts) {
          await sleep(baseDelayMs * 2 ** (attempt - 1));
        }
      }

      await supabase
        .from("notifications")
        .update({
          status: finalStatus,
          sent_at: sentAt
        })
        .eq("id", notificationId);
    }
  }

  return {
    ok: true,
    notificationId,
    targets,
    skipped: false,
    reason: null
  };
}
