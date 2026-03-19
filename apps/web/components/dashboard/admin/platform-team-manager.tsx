"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Copy, RotateCcw, ShieldOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";

type TeamRole = "admin" | "support";
type ViewerRole = "user" | TeamRole;

type TeamMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  global_role: TeamRole;
  created_at: string;
};

type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

type TeamResponse = {
  role: ViewerRole;
  members?: TeamMember[];
  invites?: TeamInvite[];
  invite?: TeamInvite;
  inviteToken?: string;
  emailSent?: boolean;
  emailError?: string | null;
  error?: string;
};

type TeamRow =
  | {
      kind: "member";
      id: string;
      name: string;
      email: string;
      role: TeamRole;
      statusLabel: string;
      createdLabel: string;
    }
  | {
      kind: "invite";
      id: string;
      name: string;
      email: string;
      role: TeamRole;
      statusLabel: string;
      createdLabel: string;
      inviteId: string;
    };

function formatInviteStatus(status: TeamInvite["status"]) {
  if (status === "pending") return "Pending invite acceptance";
  if (status === "accepted") return "Accepted";
  if (status === "revoked") return "Revoked";
  return "Expired";
}

export function PlatformTeamManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("support");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ role: ViewerRole; members: TeamMember[]; invites: TeamInvite[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/team", { cache: "no-store" });
      const payload = (await response.json()) as TeamResponse;
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "Unable to load team.");
        setLoading(false);
        return;
      }
      setData({
        role: payload.role,
        members: payload.members ?? [],
        invites: payload.invites ?? []
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamRows = useMemo<TeamRow[]>(() => {
    const memberRows: TeamRow[] = (data?.members ?? []).map((member) => ({
      kind: "member",
      id: member.id,
      name: member.display_name ?? member.email ?? member.id,
      email: member.email ?? "No email",
      role: member.global_role,
      statusLabel: "Active",
      createdLabel: `Joined ${new Date(member.created_at).toLocaleDateString()}`
    }));

    const inviteRows: TeamRow[] = (data?.invites ?? [])
      .filter((invite) => invite.status === "pending")
      .map((invite) => ({
        kind: "invite",
        id: `invite-${invite.id}`,
        name: invite.email,
        email: invite.email,
        role: invite.role,
        statusLabel: formatInviteStatus(invite.status),
        createdLabel: `Invited ${new Date(invite.created_at).toLocaleDateString()} · expires ${new Date(invite.expires_at).toLocaleDateString()}`,
        inviteId: invite.id
      }));

    return [...memberRows, ...inviteRows];
  }, [data?.invites, data?.members]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return teamRows.filter((row) => {
      if (!normalizedQuery) {
        return true;
      }
      return [row.name, row.email, row.id].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [query, teamRows]);

  const pendingInvites = useMemo(() => (data?.invites ?? []).filter((invite) => invite.status === "pending"), [data?.invites]);
  const canMutate = data?.role === "admin";

  async function refreshTeam() {
    const response = await fetch("/api/platform/team", { cache: "no-store" });
    const payload = (await response.json()) as TeamResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh team.");
    }
    setData({
      role: payload.role,
      members: payload.members ?? [],
      invites: payload.invites ?? []
    });
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      return;
    }
    setSaving(true);
    setError(null);

    const response = await fetch("/api/platform/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
    });
    const payload = (await response.json()) as TeamResponse;
    if (!response.ok || !payload.invite) {
      setError(payload.error ?? "Unable to send invite.");
      setSaving(false);
      return;
    }

    await refreshTeam();
    setInviteEmail("");
    setInviteRole("support");
    setInviteOpen(false);
    setSaving(false);
    if (payload.emailSent === false) {
      notify.warning("Invite created, but the email could not be sent.", {
        description: payload.emailError ?? "Copy the invite link and share it manually."
      });
      return;
    }
    notify.success("Platform team invite sent.");
  }

  async function updateRole(userId: string, role: ViewerRole) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/platform/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalRole: role })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to update role.");
      setSaving(false);
      return;
    }
    await refreshTeam();
    setSaving(false);
    notify.success("Platform access updated.");
  }

  async function copyInviteLink(inviteId: string) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/platform/team/invites/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: false })
    });
    const payload = (await response.json()) as TeamResponse;
    if (!response.ok || !payload.inviteToken) {
      setError(payload.error ?? "Unable to generate invite link.");
      setSaving(false);
      return;
    }

    await refreshTeam();
    setSaving(false);
    const inviteUrl = `${window.location.origin}/invite/${payload.inviteToken}`;
    if (!navigator?.clipboard) {
      notify.warning("Invite link created, but clipboard is unavailable.", { description: inviteUrl });
      return;
    }
    await navigator.clipboard.writeText(inviteUrl);
    notify.success("Invite link copied.");
  }

  async function resendInvite(inviteId: string) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/platform/team/invites/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: true })
    });
    const payload = (await response.json()) as TeamResponse;
    if (!response.ok) {
      setError(payload.error ?? "Unable to resend invite.");
      setSaving(false);
      return;
    }
    await refreshTeam();
    setSaving(false);
    if (payload.emailSent === false) {
      notify.warning("Invite reissued, but the email could not be sent.", {
        description: payload.emailError ?? "Use the copied invite link instead."
      });
      return;
    }
    notify.success("Invite resent.");
  }

  async function revokeInvite(inviteId: string) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/platform/team/invites/${inviteId}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to revoke invite.");
      setSaving(false);
      return;
    }
    await refreshTeam();
    setSaving(false);
    notify.success("Invite revoked.");
  }

  return (
    <section>
      <SectionCard title="Platform Team" description="Manage internal admin and support access for the Myrivo workspace in one place.">
        <AppAlert variant="error" message={error} className="mb-2" />
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading platform team..."
              : `${data?.members.length ?? 0} active team member(s) · ${pendingInvites.length} pending invite(s)`}
          </div>
          {canMutate ? (
            <DialogPrimitive.Root open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogPrimitive.Trigger asChild>
                <Button type="button" size="sm">Invite Team Member</Button>
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-5 shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <DialogPrimitive.Title className="text-base font-semibold">Invite platform team member</DialogPrimitive.Title>
                      <DialogPrimitive.Description className="text-sm text-muted-foreground">
                        Send an invite for admin or support access to the Myrivo admin workspace.
                      </DialogPrimitive.Description>
                    </div>
                    <DialogPrimitive.Close asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogPrimitive.Close>
                  </div>

                  <div className="space-y-4">
                    <FormField label="Email">
                      <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" />
                    </FormField>
                    <FormField label="Role">
                      <select
                        className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                      >
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                      </select>
                    </FormField>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                      <Button type="button" onClick={() => void inviteMember()} disabled={saving || !inviteEmail.trim()}>
                        {saving ? "Sending..." : "Send invite"}
                      </Button>
                    </div>
                  </div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          ) : null}
        </div>

        <div className="pb-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team members by name or email" />
        </div>

        <div className="overflow-hidden rounded-md border border-border/70">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_160px_180px] gap-3 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border/70">
            {visibleRows.map((row) => (
              <div key={row.id} className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_120px_160px_180px] md:items-center">
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.createdLabel}</p>
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground md:text-sm md:normal-case md:tracking-normal">
                  {row.role}
                </div>
                <div className="text-xs text-muted-foreground md:text-sm">{row.statusLabel}</div>
                <div className="flex items-center gap-1 md:justify-end">
                  {row.kind === "member" ? (
                    canMutate ? (
                      <select
                        className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
                        value={row.role}
                        disabled={saving}
                        onChange={(event) => void updateRole(row.id, event.target.value as ViewerRole)}
                      >
                        <option value="support">support</option>
                        <option value="admin">admin</option>
                        <option value="user">remove access</option>
                      </select>
                    ) : null
                  ) : canMutate ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void copyInviteLink(row.inviteId)}
                        disabled={saving}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void resendInvite(row.inviteId)}
                        disabled={saving}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void revokeInvite(row.inviteId)}
                        disabled={saving}
                      >
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!loading && visibleRows.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">No team members or pending invites match the current filters.</div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
