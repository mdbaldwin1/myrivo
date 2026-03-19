"use client";

import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";

type UserRole = "user" | "support" | "admin";

type PlatformUsersResponse = {
  role: UserRole;
  summary: {
    usersTotal: number;
    userRoleCounts: Record<UserRole, number>;
  };
  users: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    global_role: UserRole;
    created_at: string;
    activeStoreCount: number;
    ownerStoreCount: number;
  }>;
  error?: string;
};

const roleOptions: UserRole[] = ["user", "support", "admin"];

export function PlatformUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [data, setData] = useState<PlatformUsersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/users", { cache: "no-store" });
      const payload = (await response.json()) as PlatformUsersResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load users.");
        setLoading(false);
        return;
      }
      setData(payload);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      if (roleFilter !== "all" && user.global_role !== roleFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [user.display_name ?? "", user.email ?? "", user.id].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data?.users, query, roleFilter]);

  async function updateUserRole(userId: string, nextRole: UserRole) {
    if (savingUserId) {
      return;
    }

    setSavingUserId(userId);
    setError(null);
    const response = await fetch(`/api/platform/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalRole: nextRole })
    });
    const payload = (await response.json()) as { user?: PlatformUsersResponse["users"][number]; error?: string };
    if (!response.ok || !payload.user) {
      setError(payload.error ?? "Unable to update user role.");
      setSavingUserId(null);
      return;
    }
    const nextUser = payload.user;

    setData((current) => {
      if (!current) {
        return current;
      }

      const previousUser = current.users.find((entry) => entry.id === userId);
      const previousRole = previousUser?.global_role;
      return {
        ...current,
        summary: {
          ...current.summary,
          userRoleCounts: {
            ...current.summary.userRoleCounts,
            ...(previousRole ? { [previousRole]: Math.max(0, (current.summary.userRoleCounts[previousRole] ?? 0) - 1) } : {}),
            [nextUser.global_role]: (current.summary.userRoleCounts[nextUser.global_role] ?? 0) + (previousRole === nextUser.global_role ? 0 : 1)
          }
        },
        users: current.users.map((entry) => (entry.id === userId ? nextUser : entry))
      };
    });
    setSavingUserId(null);
  }

  const canMutate = data?.role === "admin";

  return (
    <section className="space-y-4">
      <SectionCard title="User Directory" description="Browse platform users and manage global roles in one place.">
        <AppAlert variant="error" message={error} className="mb-2" />
        {loading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">
              <p className="font-medium">Total users</p>
              <p className="text-muted-foreground">{data.summary.usersTotal}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">
              <p className="font-medium">Admins + support</p>
              <p className="text-muted-foreground">
                {(data.summary.userRoleCounts.admin ?? 0) + (data.summary.userRoleCounts.support ?? 0)}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">
              <p className="font-medium">Customers</p>
              <p className="text-muted-foreground">{data.summary.userRoleCounts.user ?? 0}</p>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Users" description="Search by name or email, then adjust platform roles when needed.">
        <div className="grid gap-2 pb-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <input
            className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users by name or email"
          />
          <select
            className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
          >
            <option value="all">All roles</option>
            <option value="admin">Admins</option>
            <option value="support">Support</option>
            <option value="user">Users</option>
          </select>
        </div>

        {visibleUsers.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No users match the current filters.</p> : null}

        <div className="space-y-2">
          {visibleUsers.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{user.display_name ?? user.email ?? user.id}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user.activeStoreCount} active store membership(s)
                  {user.ownerStoreCount > 0 ? ` · ${user.ownerStoreCount} owner role(s)` : ""}
                  {` · joined ${new Date(user.created_at).toLocaleDateString()}`}
                </p>
              </div>
              {canMutate ? (
                <select
                  className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
                  value={user.global_role}
                  disabled={savingUserId === user.id}
                  onChange={(event) => void updateUserRole(user.id, event.target.value as UserRole)}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{user.global_role}</span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
