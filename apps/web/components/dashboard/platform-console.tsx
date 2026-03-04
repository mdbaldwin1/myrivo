"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type PlatformConsoleProps = {
  currentGlobalRole: "user" | "support" | "admin";
};

type PlatformOverviewResponse = {
  role: "user" | "support" | "admin";
  summary: {
    storeStatusCounts: Record<string, number>;
    userRoleCounts: Record<string, number>;
  };
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: "draft" | "active" | "suspended";
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

export function PlatformConsole({ currentGlobalRole }: PlatformConsoleProps) {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PlatformOverviewResponse | null>(null);

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

  return (
    <section className="space-y-4">
      <SectionCard title="Platform Snapshot">
        {loading ? <p className="text-sm text-muted-foreground">Loading platform data...</p> : null}
        {overview ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-background p-3 text-sm">
              <p className="font-medium">Store Status</p>
              <p className="text-muted-foreground">Active: {overview.summary.storeStatusCounts.active ?? 0}</p>
              <p className="text-muted-foreground">Draft: {overview.summary.storeStatusCounts.draft ?? 0}</p>
              <p className="text-muted-foreground">Suspended: {overview.summary.storeStatusCounts.suspended ?? 0}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3 text-sm">
              <p className="font-medium">User Roles</p>
              <p className="text-muted-foreground">Admins: {overview.summary.userRoleCounts.admin ?? 0}</p>
              <p className="text-muted-foreground">Support: {overview.summary.userRoleCounts.support ?? 0}</p>
              <p className="text-muted-foreground">Users: {overview.summary.userRoleCounts.user ?? 0}</p>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Recent Stores">
        {overview ? (
          <div className="space-y-2 text-sm">
            {overview.stores.map((store) => (
              <div key={store.id} className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                <span className="font-medium">
                  {store.name} <span className="text-muted-foreground">({store.slug})</span>
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{store.status}</span>
              </div>
            ))}
          </div>
        ) : null}
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
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </SectionCard>
    </section>
  );
}
