"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlatformReviewsHealthPanel } from "@/components/dashboard/admin/platform-reviews-health-panel";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type PlatformConsoleProps = {
  currentGlobalRole: "user" | "support" | "admin";
};

type PlatformOverviewResponse = {
  role: "user" | "support" | "admin";
  summary: {
    storesTotal: number;
    usersTotal: number;
    pendingReviewsCount: number;
    storeStatusCounts: Record<string, number>;
    userRoleCounts: Record<string, number>;
  };
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: "draft" | "pending_review" | "active" | "suspended";
    created_at: string;
  }>;
  users: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    global_role: "user" | "support" | "admin";
    created_at: string;
  }>;
  error?: string;
};

type PlatformNotificationsHealthResponse = {
  summary: {
    notificationsTotal: number;
    notificationsFailed: number;
    notificationsPending: number;
    deliveryAttemptsTotal: number;
    deliveryAttemptsFailed: number;
    emailSuccessRate: number;
    avgSendLatencySeconds: number;
  };
  byEventType: Array<{
    eventType: string;
    total: number;
    failed: number;
  }>;
  byChannel: Array<{
    channel: string;
    total: number;
    sent: number;
    failed: number;
  }>;
  recentFailures: Array<{
    notificationId: string;
    eventType: string;
    recipientEmail: string | null;
    channel: string;
    error: string | null;
    createdAt: string;
  }>;
  error?: string;
};

export function PlatformConsole({ currentGlobalRole }: PlatformConsoleProps) {
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PlatformOverviewResponse | null>(null);
  const [notificationsHealth, setNotificationsHealth] = useState<PlatformNotificationsHealthResponse | null>(null);
  const pendingReviewStores = overview?.stores.filter((store) => store.status === "pending_review") ?? [];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/overview", { cache: "no-store" });
      const payload = (await response.json()) as PlatformOverviewResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load platform overview.");
        setLoading(false);
        return;
      }
      setOverview(payload);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/notifications/health", { cache: "no-store" });
      const payload = (await response.json()) as PlatformNotificationsHealthResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setHealthError(payload.error ?? "Unable to load notification health.");
        setHealthLoading(false);
        return;
      }
      setNotificationsHealth(payload);
      setHealthLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateUserRole(userId: string, nextRole: "user" | "support" | "admin") {
    setSavingUserId(userId);
    setError(null);
    const response = await fetch(`/api/platform/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalRole: nextRole })
    });
    const payload = (await response.json()) as { user?: PlatformOverviewResponse["users"][number]; error?: string };
    if (!response.ok || !payload.user) {
      setError(payload.error ?? "Unable to update user role.");
      setSavingUserId(null);
      return;
    }
    setOverview((current) =>
      current
        ? {
            ...current,
            users: current.users.map((entry) => (entry.id === userId ? payload.user! : entry))
          }
        : current
    );
    setSavingUserId(null);
  }

  async function reviewStore(storeId: string, action: "approve" | "reject" | "suspend") {
    setSavingStoreId(storeId);
    setError(null);
    const response = await fetch(`/api/platform/stores/${storeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { store?: PlatformOverviewResponse["stores"][number]; error?: string };
    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to update store status.");
      setSavingStoreId(null);
      return;
    }
    setOverview((current) =>
      current
        ? {
            ...current,
            stores: current.stores.map((entry) => (entry.id === storeId ? payload.store! : entry)),
            summary: {
              ...current.summary,
              storeStatusCounts: current.stores.reduce<Record<string, number>>((acc, entry) => {
                const status = entry.id === storeId ? payload.store!.status : entry.status;
                acc[status] = (acc[status] ?? 0) + 1;
                return acc;
              }, {})
            }
          }
        : current
    );
    setSavingStoreId(null);
  }

  return (
    <section className="space-y-4">
      <SectionCard title="Platform Snapshot">
        {loading ? <p className="text-sm text-muted-foreground">Loading platform data...</p> : null}
        {overview ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-background p-3 text-sm">
              <p className="font-medium">Store Status</p>
              <p className="text-muted-foreground">Total: {overview.summary.storesTotal}</p>
              <p className="text-muted-foreground">Active: {overview.summary.storeStatusCounts.active ?? 0}</p>
              <p className="text-muted-foreground">Pending Review: {overview.summary.storeStatusCounts.pending_review ?? 0}</p>
              <p className="text-muted-foreground">Draft: {overview.summary.storeStatusCounts.draft ?? 0}</p>
              <p className="text-muted-foreground">Suspended: {overview.summary.storeStatusCounts.suspended ?? 0}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3 text-sm">
              <p className="font-medium">User Roles</p>
              <p className="text-muted-foreground">Total: {overview.summary.usersTotal}</p>
              <p className="text-muted-foreground">Admins: {overview.summary.userRoleCounts.admin ?? 0}</p>
              <p className="text-muted-foreground">Support: {overview.summary.userRoleCounts.support ?? 0}</p>
              <p className="text-muted-foreground">Users: {overview.summary.userRoleCounts.user ?? 0}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3 text-sm sm:col-span-2">
              <p className="font-medium">Moderation Queue</p>
              <p className="text-muted-foreground">Pending reviews across stores: {overview.summary.pendingReviewsCount}</p>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <PlatformReviewsHealthPanel />

      <SectionCard title="Approval Queue" description="Stores waiting for review before going live.">
        {overview ? (
          pendingReviewStores.length > 0 ? (
            <div className="space-y-2 text-sm">
              {pendingReviewStores.map((store) => (
                <div key={`queue-${store.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                  <div>
                    <p className="font-medium">
                      {store.name} <span className="text-muted-foreground">({store.slug})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Created {new Date(store.created_at).toLocaleString()}</p>
                  </div>
                  {currentGlobalRole === "admin" ? (
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => void reviewStore(store.id, "approve")} disabled={savingStoreId === store.id}>
                        Approve
                      </Button>
                      <Link href="/dashboard/admin/stores" className="text-xs font-medium text-primary hover:underline">
                        Reasoned Actions
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Admin approval required</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No stores pending review.</p>
          )
        ) : null}
      </SectionCard>

      <SectionCard title="Recent Stores">
        {overview ? (
          <div className="space-y-2 text-sm">
            {overview.stores.map((store) => (
              <div key={store.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                <div>
                  <p className="font-medium">
                    {store.name} <span className="text-muted-foreground">({store.slug})</span>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{store.status.replace("_", " ")}</p>
                </div>
                {currentGlobalRole === "admin" && store.status === "pending_review" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void reviewStore(store.id, "approve")}
                      disabled={savingStoreId === store.id}
                    >
                      Approve
                    </Button>
                    <Link href="/dashboard/admin/stores" className="text-xs font-medium text-primary hover:underline">
                      Reasoned Actions
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Notification Delivery Health" description="Recent dispatch volume, failure rate, and channel health.">
        {healthLoading ? <p className="text-sm text-muted-foreground">Loading delivery health...</p> : null}
        {notificationsHealth ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="font-medium">Notifications</p>
                <p className="text-muted-foreground">{notificationsHealth.summary.notificationsTotal}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="font-medium">Failed</p>
                <p className="text-muted-foreground">{notificationsHealth.summary.notificationsFailed}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="font-medium">Email Success</p>
                <p className="text-muted-foreground">{notificationsHealth.summary.emailSuccessRate}%</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="font-medium">Avg Send Latency</p>
                <p className="text-muted-foreground">{notificationsHealth.summary.avgSendLatencySeconds}s</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="mb-2 font-medium">Top Event Types</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {notificationsHealth.byEventType.slice(0, 6).map((entry) => (
                    <p key={entry.eventType}>
                      {entry.eventType}: {entry.total} total, {entry.failed} failed
                    </p>
                  ))}
                  {notificationsHealth.byEventType.length === 0 ? <p>No events in window.</p> : null}
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="mb-2 font-medium">Channel Attempts</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {notificationsHealth.byChannel.map((entry) => (
                    <p key={entry.channel}>
                      {entry.channel}: {entry.total} attempts, {entry.failed} failed
                    </p>
                  ))}
                  {notificationsHealth.byChannel.length === 0 ? <p>No attempts in window.</p> : null}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="mb-2 font-medium">Recent Delivery Failures</p>
              <div className="space-y-2 text-xs">
                {notificationsHealth.recentFailures.slice(0, 10).map((failure) => (
                  <div key={`${failure.notificationId}-${failure.createdAt}`} className="rounded border border-border/60 px-2 py-2">
                    <p className="font-medium">{failure.eventType}</p>
                    <p className="text-muted-foreground">{failure.recipientEmail ?? "Unknown recipient"}</p>
                    <p className="text-muted-foreground">{failure.error ?? "Unknown error"}</p>
                  </div>
                ))}
                {notificationsHealth.recentFailures.length === 0 ? (
                  <p className="text-muted-foreground">No recent failed delivery attempts.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <AppAlert variant="error" message={healthError} className="mt-2" />
      </SectionCard>

      <SectionCard
        title="User Roles"
        action={
          <Button type="button" variant="outline" size="sm" disabled>
            {currentGlobalRole === "admin" ? "Admin Controls Enabled" : "Read-only (Support)"}
          </Button>
        }
      >
        {overview ? (
          <div className="space-y-2 text-sm">
            {overview.users.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                <div>
                  <p className="font-medium">{profile.display_name ?? profile.email ?? profile.id}</p>
                  <p className="text-xs text-muted-foreground">{profile.email ?? "No email"}</p>
                </div>
                {currentGlobalRole === "admin" ? (
                  <select
                    className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
                    value={profile.global_role}
                    disabled={savingUserId === profile.id}
                    onChange={(event) => void updateUserRole(profile.id, event.target.value as "user" | "support" | "admin")}
                  >
                    <option value="user">user</option>
                    <option value="support">support</option>
                    <option value="admin">admin</option>
                  </select>
                ) : (
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{profile.global_role}</span>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <AppAlert variant="error" message={error} className="mt-2" />
      </SectionCard>
    </section>
  );
}
