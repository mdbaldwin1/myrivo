"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildStoreWorkspacePath } from "@/lib/routes/store-workspace";
import type { NotificationSeverity, NotificationStatus } from "@/types/database";

type FeedMode = "compact" | "full";
type FeedStatusFilter = "all" | "unread" | "read" | "dismissed" | "pending" | "sent" | "failed";
type NotificationItem = {
  id: string;
  store_id: string;
  event_type: string;
  title: string;
  body: string;
  action_url: string | null;
  severity: NotificationSeverity;
  status: NotificationStatus;
  read_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

type NotificationsFeedProps = {
  storeSlug: string | null;
  mode?: FeedMode;
  onUnreadCountChange?: (count: number) => void;
  onNavigate?: () => void;
  className?: string;
};

function formatTimeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityClassName(severity: NotificationSeverity) {
  if (severity === "critical") {
    return "border-rose-300/70 bg-rose-50";
  }
  if (severity === "warning") {
    return "border-amber-300/70 bg-amber-50";
  }
  return "border-border/70 bg-white";
}

function normalizeLegacyDashboardActionUrl(actionUrl: string) {
  const normalized = actionUrl.replace(/\/+$/, "");
  if (normalized === "/dashboard/products") {
    return "/dashboard/catalog";
  }
  return actionUrl;
}

function resolveActionHref(actionUrl: string | null, storeSlug: string | null) {
  if (!actionUrl) {
    return null;
  }
  if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) {
    return actionUrl;
  }
  const resolvedActionUrl = normalizeLegacyDashboardActionUrl(actionUrl);
  if (resolvedActionUrl.startsWith("/dashboard/stores/")) {
    return resolvedActionUrl;
  }
  if (resolvedActionUrl.startsWith("/dashboard/customer-orders/") || resolvedActionUrl === "/dashboard/customer-orders") {
    return resolvedActionUrl;
  }
  if (resolvedActionUrl.startsWith("/dashboard/")) {
    const childPath = resolvedActionUrl.slice("/dashboard".length) || "/";
    return buildStoreWorkspacePath(storeSlug, childPath, resolvedActionUrl);
  }
  if (resolvedActionUrl.startsWith("/")) {
    return resolvedActionUrl;
  }
  return buildStoreWorkspacePath(storeSlug, resolvedActionUrl);
}

export function NotificationsFeed({
  storeSlug,
  mode = "full",
  onUnreadCountChange,
  onNavigate,
  className
}: NotificationsFeedProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FeedStatusFilter>(mode === "compact" ? "unread" : "all");
  const [refreshToken, setRefreshToken] = useState(0);

  const limit = mode === "compact" ? 8 : 40;

  const syncUnreadCount = useCallback(
    (count: number) => {
      setUnreadCount(count);
      onUnreadCountChange?.(count);
    },
    [onUnreadCountChange]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: "0",
        status: statusFilter
      });
      const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as NotificationsResponse & { error?: string };
      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setItems([]);
        syncUnreadCount(0);
        setLoading(false);
        return;
      }

      setItems(payload.notifications ?? []);
      syncUnreadCount(payload.unreadCount ?? 0);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [limit, statusFilter, refreshToken, syncUnreadCount]);

  async function updateNotification(id: string, action: "read" | "unread" | "dismiss") {
    setMutatingId(id);
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });

    if (response.ok) {
      setLoading(true);
      setRefreshToken((current) => current + 1);
    }
    setMutatingId(null);
  }

  async function markAllRead() {
    setMarkingAll(true);
    const response = await fetch("/api/notifications/read-all", {
      method: "POST"
    });

    if (response.ok) {
      setLoading(true);
      setRefreshToken((current) => current + 1);
    }
    setMarkingAll(false);
  }

  async function markNotificationReadOnOpen(id: string, isRead: boolean) {
    if (isRead) {
      return;
    }

    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
      keepalive: true
    }).catch(() => undefined);
  }

  const filters = useMemo<Array<{ value: FeedStatusFilter; label: string }>>(
    () => [
      { value: "all", label: "All" },
      { value: "unread", label: "Unread" },
      { value: "read", label: "Read" },
      { value: "dismissed", label: "Dismissed" }
    ],
    []
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {mode === "full" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {filters.map((filter) => (
                <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={statusFilter === filter.value ? "default" : "outline"}
                onClick={() => {
                  setLoading(true);
                  setStatusFilter(filter.value);
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void markAllRead()} disabled={markingAll || unreadCount === 0}>
            {markingAll ? "Updating..." : "Mark all read"}
          </Button>
        </div>
      ) : null}

      <div className={cn("space-y-2", mode === "compact" ? "max-h-[26rem] overflow-y-auto pb-4" : "")}>
        {loading ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading notifications...</p> : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-5 text-sm text-muted-foreground">No notifications yet.</div>
        ) : null}

        {!loading
          ? items.map((item) => {
              const href = resolveActionHref(item.action_url, storeSlug);
              const isRead = Boolean(item.read_at);
              return (
                <article key={item.id} className={cn("rounded-md border p-3", severityClassName(item.severity))}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{formatTimeAgo(item.created_at)}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {href ? (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={href}
                          onClick={() => {
                            void markNotificationReadOnOpen(item.id, isRead);
                            onNavigate?.();
                          }}
                        >
                          Open
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={mutatingId === item.id}
                      onClick={() => void updateNotification(item.id, isRead ? "unread" : "read")}
                    >
                      {isRead ? "Mark unread" : "Mark read"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={mutatingId === item.id || item.status === "dismissed"}
                      onClick={() => void updateNotification(item.id, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  </div>
                </article>
              );
            })
          : null}
      </div>
    </div>
  );
}
