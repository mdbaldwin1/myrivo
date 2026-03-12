"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Copy, RotateCcw, ShieldOff, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type MemberRecord = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "staff";
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
  role: "admin" | "staff";
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
      inviteId: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const highlightedMemberUserId = searchParams.get("memberUserId");
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const fetchMembers = useCallback(async () => {
    const response = await fetch(buildStoreScopedApiPath("/api/stores/members", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as MembersResponse;
    return { ok: response.ok, payload };
  }, [storeSlug]);

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
  }, [fetchMembers]);

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
        inviteId: invite.id,
        email: invite.email,
        displayName: invite.email,
        role: invite.role,
        rawStatus: invite.status,
        statusLabel: formatInviteStatus(invite.status),
        invitedAt: invite.created_at
      }));

    return [...memberRows, ...pendingInviteRows];
  }, [invites, members]);

  const highlightedRowId = useMemo(() => {
    if (!highlightedMemberUserId) {
      return null;
    }
    const matchingMember = members.find((member) => member.user_id === highlightedMemberUserId);
    return matchingMember ? matchingMember.id : null;
  }, [highlightedMemberUserId, members]);

  useEffect(() => {
    if (!highlightedRowId || !highlightedRowRef.current) {
      return;
    }
    highlightedRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedRowId]);

  function clearHighlightedMember() {
    if (!highlightedMemberUserId) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("memberUserId");
    const nextSearch = nextParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    setInviteError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/members", storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        role: inviteRole
      })
    });

    const payload = (await response.json()) as {
      invite?: InviteRecord;
      inviteToken?: string;
      emailSent?: boolean;
      emailError?: string | null;
      error?: string;
    };
    if (!response.ok || !payload.invite) {
      setInviteError(payload.error ?? "Unable to send invite.");
      setSaving(false);
      return;
    }

    setInvites((current) => [payload.invite!, ...current.filter((entry) => entry.id !== payload.invite!.id)]);
    setInviteEmail("");
    setInviteRole("staff");
    setInviteOpen(false);
    setSaving(false);
    if (payload.emailSent === false) {
      notify.warning("Invite created, but the email could not be sent.", {
        description: payload.emailError ?? "Share the invite link manually."
      });
      return;
    }
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

  async function copyInviteLink(inviteId: string) {
    setSaving(true);
    setError(null);
    setInviteError(null);
    const response = await fetch(buildStoreScopedApiPath(`/api/stores/members/invites/${inviteId}`, storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: false })
    });
    const payload = (await response.json()) as {
      invite?: InviteRecord;
      inviteToken?: string;
      error?: string;
    };

    if (!response.ok || !payload.invite || !payload.inviteToken) {
      setError(payload.error ?? "Unable to generate invite link.");
      setSaving(false);
      return;
    }

    const nextInviteLink = `${window.location.origin}/invite/${payload.inviteToken}`;
    setInvites((current) => [payload.invite!, ...current.filter((entry) => entry.id !== inviteId && entry.id !== payload.invite!.id)]);
    setSaving(false);

    if (!navigator?.clipboard) {
      notify.warning("New invite link created, but clipboard is unavailable.", {
        description: nextInviteLink
      });
      return;
    }

    await navigator.clipboard.writeText(nextInviteLink);
    notify.success("Invite link copied.");
  }

  async function resendInvite(inviteId: string) {
    setSaving(true);
    setError(null);
    setInviteError(null);
    const response = await fetch(buildStoreScopedApiPath(`/api/stores/members/invites/${inviteId}`, storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: true })
    });
    const payload = (await response.json()) as {
      invite?: InviteRecord;
      inviteToken?: string;
      emailSent?: boolean;
      emailError?: string | null;
      error?: string;
    };

    if (!response.ok || !payload.invite) {
      setError(payload.error ?? "Unable to resend invite.");
      setSaving(false);
      return;
    }

    setInvites((current) => [payload.invite!, ...current.filter((entry) => entry.id !== inviteId && entry.id !== payload.invite!.id)]);
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
    setInviteError(null);
    const response = await fetch(buildStoreScopedApiPath(`/api/stores/members/invites/${inviteId}`, storeSlug), {
      method: "DELETE"
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to revoke invite.");
      setSaving(false);
      return;
    }

    setInvites((current) => current.filter((entry) => entry.id !== inviteId));
    setSaving(false);
    notify.success("Invite revoked.");
  }

  function renderActionIconButton({
    label,
    icon,
    onClick,
    disabled,
    className
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
  }) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={label} onClick={onClick} className={className}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
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
                    <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "staff")}>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
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
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
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
              {rows.map((row) => {
                const isHighlighted = row.kind === "member" && row.id === highlightedRowId;
                return (
                <tr
                  key={row.id}
                  ref={isHighlighted ? highlightedRowRef : null}
                  className={isHighlighted ? "border-t border-primary/40 bg-primary/5" : "border-t border-border/70"}
                >
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
                      </Select>
                    ) : (
                      <span className="capitalize">{row.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">{row.statusLabel}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.kind === "member" && row.canManage ? (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {isHighlighted ? (
                          renderActionIconButton({
                            label: "Clear highlight",
                            icon: <X className="h-4 w-4" />,
                            disabled: saving,
                            onClick: clearHighlightedMember
                          })
                        ) : null}
                        {renderActionIconButton({
                          label: row.rawStatus === "suspended" ? "Reactivate member" : "Suspend member",
                          icon: <ShieldOff className="h-4 w-4" />,
                          disabled: saving,
                          onClick: () =>
                            void updateMembership(row.membershipId, {
                              status: row.rawStatus === "suspended" ? "active" : "suspended"
                            })
                        })}
                        {renderActionIconButton({
                          label: "Remove member",
                          icon: <Trash2 className="h-4 w-4" />,
                          disabled: saving,
                          className: "text-destructive hover:text-destructive hover:bg-destructive/10",
                          onClick: () => void removeMembership(row.membershipId)
                        })}
                      </div>
                    ) : row.kind === "invite" ? (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {renderActionIconButton({
                          label: "Copy invite link",
                          icon: <Copy className="h-4 w-4" />,
                          disabled: saving,
                          onClick: () => void copyInviteLink(row.inviteId)
                        })}
                        {renderActionIconButton({
                          label: "Resend invite",
                          icon: <RotateCcw className="h-4 w-4" />,
                          disabled: saving,
                          onClick: () => void resendInvite(row.inviteId)
                        })}
                        {renderActionIconButton({
                          label: "Revoke invite",
                          icon: <Trash2 className="h-4 w-4" />,
                          disabled: saving,
                          className: "text-destructive hover:text-destructive hover:bg-destructive/10",
                          onClick: () => void revokeInvite(row.inviteId)
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isHighlighted ? "Opened from notification" : "No actions"}</span>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <AppAlert variant="error" message={error} />
      </SectionCard>
    </TooltipProvider>
  );
}
