"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

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

export function TeamManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff" | "customer">("staff");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  async function fetchMembers() {
    const response = await fetch("/api/stores/members", { cache: "no-store" });
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
  }, []);

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    setLastInviteToken(null);

    const response = await fetch("/api/stores/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        role: inviteRole
      })
    });

    const payload = (await response.json()) as { invite?: InviteRecord; inviteToken?: string; error?: string };
    if (!response.ok || !payload.invite) {
      setError(payload.error ?? "Unable to send invite.");
      setSaving(false);
      return;
    }

    setInvites((current) => [payload.invite!, ...current.filter((entry) => entry.id !== payload.invite!.id)]);
    setInviteEmail("");
    setLastInviteToken(payload.inviteToken ?? null);
    setSaving(false);
  }

  async function updateMembership(membershipId: string, payload: { role?: MemberRecord["role"]; status?: "active" | "suspended" }) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/stores/members/${membershipId}`, {
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
  }

  async function removeMembership(membershipId: string) {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/stores/members/${membershipId}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to remove member.");
      setSaving(false);
      return;
    }
    setMembers((current) => current.filter((entry) => entry.id !== membershipId));
    setSaving(false);
  }

  return (
    <section className="space-y-4">
      <SectionCard
        title="Invite Team Member"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void inviteMember()} disabled={saving || !inviteEmail.trim()}>
            Send invite
          </Button>
        }
      >
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Invite Details</p>
          <p className="mt-1 text-xs text-muted-foreground">Send an invite link and assign the initial store-level role.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="Email" description="Invite by email. The invite can be accepted only by this email address.">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="staff@yourshop.com" />
            </FormField>
            <FormField label="Role" description="Initial store-level role for the invited user.">
              <select className="h-10 rounded-md border border-border/70 bg-background px-2 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "staff" | "customer")}>
                <option value="admin">admin</option>
                <option value="staff">staff</option>
                <option value="customer">customer</option>
              </select>
            </FormField>
          </div>
        </div>
        {lastInviteToken ? (
          <p className="mt-3 break-all rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
            Invite token (share securely): {lastInviteToken}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Current Members">
        {loading ? <p className="text-sm text-muted-foreground">Loading team members...</p> : null}
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Member Access</p>
            <p className="mt-1 text-xs text-muted-foreground">Update role assignments and active/suspended status for store members.</p>
          </div>
          {members.length === 0 ? <p className="text-sm text-muted-foreground">No members found.</p> : null}
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{member.profile?.display_name ?? member.profile?.email ?? member.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {member.profile?.email ?? "No email"} · {member.status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-border/70 bg-background px-2 text-xs"
                  value={member.role}
                  disabled={saving}
                  onChange={(event) => void updateMembership(member.id, { role: event.target.value as MemberRecord["role"] })}
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="staff">staff</option>
                  <option value="customer">customer</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => void updateMembership(member.id, { status: member.status === "suspended" ? "active" : "suspended" })}
                >
                  {member.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void removeMembership(member.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Invites">
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Invitation History</p>
            <p className="mt-1 text-xs text-muted-foreground">Track pending, accepted, and expired invite links.</p>
          </div>
          {invites.length === 0 ? <p className="text-sm text-muted-foreground">No invites yet.</p> : null}
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm">
              <span>
                {invite.email} · {invite.role}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {invite.status} · expires {new Date(invite.expires_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <FeedbackMessage type="error" message={error} />
        </div>
      </SectionCard>
    </section>
  );
}
