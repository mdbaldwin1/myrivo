"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type MemberRecord = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "staff" | "customer";
  status: "active" | "invited" | "suspended";
  profile: {
    email: string | null;
    display_name: string | null;
    global_role: "user" | "support" | "admin";
  } | null;
};

type InviteRecord = {
  id: string;
  email: string;
  role: "admin" | "staff" | "customer";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

type MembersResponse = {
  members?: MemberRecord[];
  invites?: InviteRecord[];
  error?: string;
};

type TeamRow =
  | {
      kind: "member";
      id: string;
      email: string;
      displayName: string;
      role: MemberRecord["role"];
      statusLabel: string;
      rawStatus: MemberRecord["status"];
      membershipId: string;
      canManage: boolean;
    }
  | {
      kind: "invite";
      id: string;
      email: string;
      displayName: string;
      role: InviteRecord["role"];
      statusLabel: string;
      rawStatus: InviteRecord["status"];
      invitedAt: string;
    };

function formatMemberStatus(status: MemberRecord["status"]) {
  if (status === "active") return "Active";
  if (status === "suspended") return "Inactive";
  return "Pending invite acceptance";
}

function formatInviteStatus(status: InviteRecord["status"]) {
  if (status === "pending") return "Pending invite acceptance";
  if (status === "accepted") return "Accepted";
  if (status === "revoked") return "Revoked";
  return "Expired";
}

export function TeamManager() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff" | "customer">("staff");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  async function fetchMembers() {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/members", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as MembersResponse;
    return { ok: response.ok, payload };
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchMembers();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.payload.error ?? "Unable to load team members.");
        setLoading(false);
        return;
      }
      setMembers(result.payload.members ?? []);
      setInvites(result.payload.invites ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  const rows = useMemo<TeamRow[]>(() => {
    const memberRows: TeamRow[] = members.map((member) => ({
      kind: "member",
      id: member.id,
      email: member.profile?.email ?? "No email",
      displayName: member.profile?.display_name ?? member.profile?.email ?? member.user_id,
      role: member.role,
      rawStatus: member.status,
      statusLabel: formatMemberStatus(member.status),
      membershipId: member.id,
      canManage: member.role !== "owner"
    }));

    const pendingInviteRows: TeamRow[] = invites
      .filter((invite) => invite.status === "pending")
      .map((invite) => ({
        kind: "invite",
        id: `invite-${invite.id}`,
        email: invite.email,
        displayName: invite.email,
        role: invite.role,
        rawStatus: invite.status,
        statusLabel: formatInviteStatus(invite.status),
        invitedAt: invite.created_at
      }));

    return [...memberRows, ...pendingInviteRows];
  }, [invites, members]);

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    setInviteError(null);
    setLastInviteLink(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/members", storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        role: inviteRole
      })
    });

    const payload = (await response.json()) as { invite?: InviteRecord; inviteToken?: string; error?: string };
    if (!response.ok || !payload.invite) {
      setInviteError(payload.error ?? "Unable to send invite.");
      setSaving(false);
      return;
    }

    setInvites((current) => [payload.invite!, ...current.filter((entry) => entry.id !== payload.invite!.id)]);
    setInviteEmail("");
    setInviteRole("staff");
    const nextInviteLink = payload.inviteToken ? `${window.location.origin}/invite/${payload.inviteToken}` : null;
    setLastInviteLink(nextInviteLink);
    setInviteOpen(false);
    setSaving(false);
    notify.success("Invite sent.");
  }

  async function updateMembership(membershipId: string, payload: { role?: MemberRecord["role"]; status?: "active" | "suspended" }) {
    setSaving(true);
    setError(null);
    setInviteError(null);
    const response = await fetch(buildStoreScopedApiPath(`/api/stores/members/${membershipId}`, storeSlug), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = (await response.json()) as { membership?: MemberRecord; error?: string };
    if (!response.ok || !body.membership) {
      setError(body.error ?? "Unable to update membership.");
      setSaving(false);
      return;
    }
    setMembers((current) => current.map((entry) => (entry.id === membershipId ? { ...entry, ...body.membership! } : entry)));
    setSaving(false);
    notify.success("Team member updated.");
  }

  async function removeMembership(membershipId: string) {
    setSaving(true);
    setError(null);
    setInviteError(null);
    const response = await fetch(buildStoreScopedApiPath(`/api/stores/members/${membershipId}`, storeSlug), { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to remove member.");
      setSaving(false);
      return;
    }
    setMembers((current) => current.filter((entry) => entry.id !== membershipId));
    setSaving(false);
    notify.success("Team member removed.");
  }

  async function copyLatestInviteLink() {
    if (!lastInviteLink) {
      return;
    }
    if (!navigator?.clipboard) {
      notify.error("Clipboard not available in this browser.");
      return;
    }
    await navigator.clipboard.writeText(lastInviteLink);
    notify.success("Invite link copied.");
  }

  return (
    <SectionCard
      title="Team Access"
      description="View all team members and pending invites, and manage store access roles."
      action={
        <DialogPrimitive.Root
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open);
            if (!open) {
              setInviteError(null);
            }
          }}
        >
          <DialogPrimitive.Trigger asChild>
            <Button type="button" size="sm">
              Invite Team Member
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-lg">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Invite Team Member</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                Invite a user by email and assign their initial store role.
              </DialogPrimitive.Description>
              <div className="mt-4 space-y-4">
                <FormField label="Email Address" description="Invite can only be accepted by this exact email.">
                  <Input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="staff@yourshop.com"
                  />
                </FormField>
                <FormField label="Role">
                  <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "staff" | "customer")}>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                  </Select>
                </FormField>
                <div className="flex items-center justify-between gap-3">
                  <AppAlert compact variant="error" message={inviteError} className="text-sm" />
                  <div className="flex justify-end gap-2">
                    <DialogPrimitive.Close asChild>
                      <Button type="button" variant="outline" disabled={saving}>
                        Cancel
                      </Button>
                    </DialogPrimitive.Close>
                    <Button type="button" onClick={() => void inviteMember()} disabled={saving || !inviteEmail.trim()}>
                      {saving ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      }
    >
      {loading ? <p className="text-sm text-muted-foreground">Loading team members...</p> : null}

      {!loading ? (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead className="bg-muted/35 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-muted-foreground">Member</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Role</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                    No team members or pending invites yet.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.displayName}</div>
                    {row.kind === "invite" ? (
                      <p className="text-xs text-muted-foreground">Invite sent {new Date(row.invitedAt).toLocaleDateString()}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email}</td>
                  <td className="px-3 py-2">
                    {row.kind === "member" && row.canManage ? (
                      <Select
                        value={row.role}
                        disabled={saving}
                        onChange={(event) => void updateMembership(row.membershipId, { role: event.target.value as MemberRecord["role"] })}
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="customer">Customer</option>
                      </Select>
                    ) : (
                      <span className="capitalize">{row.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">{row.statusLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    {row.kind === "member" && row.canManage ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            void updateMembership(row.membershipId, {
                              status: row.rawStatus === "suspended" ? "active" : "suspended"
                            })
                          }
                        >
                          {row.rawStatus === "suspended" ? "Reactivate" : "Suspend"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void removeMembership(row.membershipId)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {lastInviteLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
          <p className="min-w-0 flex-1 break-all text-xs text-muted-foreground">Invite link (share securely): {lastInviteLink}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyLatestInviteLink()}>
            Copy link
          </Button>
        </div>
      ) : null}
      <AppAlert variant="error" message={error} />
    </SectionCard>
  );
}
