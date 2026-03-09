import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type NotificationHealthRow = {
  id: string;
  event_type: string;
  status: string;
  recipient_email: string | null;
  created_at: string;
  sent_at: string | null;
  channel_targets: Record<string, unknown> | null;
};

type DeliveryAttemptRow = {
  notification_id: string;
  channel: "in_app" | "email";
  status: "pending" | "sent" | "failed";
  error: string | null;
  created_at: string;
};

function parseWindowDays(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) {
    return 7;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
    return 7;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const windowDays = parseWindowDays(request);
  const windowStartIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const admin = createSupabaseAdminClient();
  const [{ data: notifications, error: notificationsError }, { data: attempts, error: attemptsError }] = await Promise.all([
    admin
      .from("notifications")
      .select("id,event_type,status,recipient_email,created_at,sent_at,channel_targets")
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: false })
      .limit(2000)
      .returns<NotificationHealthRow[]>(),
    admin
      .from("notification_delivery_attempts")
      .select("notification_id,channel,status,error,created_at")
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: false })
      .limit(4000)
      .returns<DeliveryAttemptRow[]>()
  ]);

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 });
  }
  if (attemptsError) {
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }

  const notificationRows = notifications ?? [];
  const attemptRows = attempts ?? [];
  const failedNotifications = notificationRows.filter((row) => row.status === "failed").length;
  const pendingNotifications = notificationRows.filter((row) => row.status === "pending").length;

  const emailAttempts = attemptRows.filter((row) => row.channel === "email");
  const emailSentCount = emailAttempts.filter((row) => row.status === "sent").length;
  const emailSuccessRate = emailAttempts.length > 0 ? Math.round((emailSentCount / emailAttempts.length) * 1000) / 10 : 100;

  const latenciesSeconds = notificationRows
    .filter((row) => row.sent_at)
    .map((row) => Math.max(0, (new Date(row.sent_at!).getTime() - new Date(row.created_at).getTime()) / 1000));
  const avgSendLatencySeconds =
    latenciesSeconds.length > 0 ? Math.round((latenciesSeconds.reduce((sum, value) => sum + value, 0) / latenciesSeconds.length) * 10) / 10 : 0;

  const byEventTypeMap = new Map<string, { eventType: string; total: number; failed: number }>();
  for (const row of notificationRows) {
    const current = byEventTypeMap.get(row.event_type) ?? { eventType: row.event_type, total: 0, failed: 0 };
    current.total += 1;
    if (row.status === "failed") {
      current.failed += 1;
    }
    byEventTypeMap.set(row.event_type, current);
  }

  const byChannelMap = new Map<string, { channel: string; total: number; sent: number; failed: number }>();
  for (const row of attemptRows) {
    const current = byChannelMap.get(row.channel) ?? { channel: row.channel, total: 0, sent: 0, failed: 0 };
    current.total += 1;
    if (row.status === "sent") {
      current.sent += 1;
    }
    if (row.status === "failed") {
      current.failed += 1;
    }
    byChannelMap.set(row.channel, current);
  }

  const notificationById = new Map(notificationRows.map((row) => [row.id, row]));
  const recentFailures = attemptRows
    .filter((row) => row.status === "failed")
    .slice(0, 20)
    .map((row) => {
      const notification = notificationById.get(row.notification_id);
      return {
        notificationId: row.notification_id,
        eventType: notification?.event_type ?? "unknown",
        recipientEmail: notification?.recipient_email ?? null,
        channel: row.channel,
        error: row.error,
        createdAt: row.created_at
      };
    });

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    windowDays,
    summary: {
      notificationsTotal: notificationRows.length,
      notificationsFailed: failedNotifications,
      notificationsPending: pendingNotifications,
      deliveryAttemptsTotal: attemptRows.length,
      deliveryAttemptsFailed: attemptRows.filter((row) => row.status === "failed").length,
      emailSuccessRate,
      avgSendLatencySeconds
    },
    byEventType: Array.from(byEventTypeMap.values()).sort((a, b) => b.total - a.total),
    byChannel: Array.from(byChannelMap.values()).sort((a, b) => b.total - a.total),
    recentFailures
  });
}
